import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaintService, PaintTool } from '../../services/paint';
import {
  Line,
  Rect,
  Ellipse,
  Triangle,
  Path,
  Textbox,
  FabricObject,
  ActiveSelection,
} from 'fabric';

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workspace.html',
  styles: `
    :host {
      display: block;
      height: 100%;
      width: 100%;
      overflow: auto;
      background-color: #0f172a;
      background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 0);
      background-size: 24px 24px;
      background-position: center;
    }
    .pixel-grid {
      background-image: 
        linear-gradient(to right, rgba(100, 116, 139, 0.25) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(100, 116, 139, 0.25) 1px, transparent 1px);
    }
    .crt-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 30;
      background: linear-gradient(
        rgba(18, 16, 16, 0) 50%, 
        rgba(0, 0, 0, 0.12) 50%
      );
      background-size: 100% 4px;
      animation: crt-flicker 0.15s infinite;
    }
    .crt-overlay::before {
      content: " ";
      display: block;
      position: absolute;
      inset: 0;
      background: radial-gradient(
        circle,
        transparent 55%,
        rgba(0, 0, 0, 0.3) 100%
      );
    }
    @keyframes crt-flicker {
      0% { opacity: 0.98; }
      50% { opacity: 1; }
      100% { opacity: 0.99; }
    }
    :host ::ng-deep .cursor-pencil .upper-canvas {
      cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg>") 2 22, crosshair !important;
    }
    :host ::ng-deep .cursor-eraser .upper-canvas {
      cursor: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m14 3-4.9 4.9L3 14.2V21h6.8l6.3-6.3L21 9.8Z'/><path d='m8.5 8.5 5 5'/></svg>") 3 21, cell !important;
    }
    :host ::ng-deep .cursor-text-tool .upper-canvas {
      cursor: text !important;
    }
    :host ::ng-deep .cursor-shape-tool .upper-canvas {
      cursor: crosshair !important;
    }
  `,
  host: {
    class: 'block relative select-none',
  },
})
export class Workspace implements AfterViewInit, OnDestroy {
  @ViewChild('canvasElement', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  public paintService = inject(PaintService);

  // Drag and drop state signal
  public isDragOver = false;

  // Signal to track when canvas has been initialized to trigger effects
  private canvasInitialized = signal<boolean>(false);

  // Drawing state variables
  private startPointer: { x: number; y: number } | null = null;
  private currentObject: FabricObject | null = null;
  private isDrawingShape = false;

  constructor() {
    // Watch activeTool and canvas initialization to configure selections and interactions
    effect(() => {
      const tool = this.paintService.activeTool();
      const initialized = this.canvasInitialized();
      const canvas = this.paintService.canvas;

      if (!canvas || !initialized) return;

      // Discard active object when switching away from select tool
      if (tool !== 'select') {
        canvas.discardActiveObject();
      }

      // Configure selection and object interactivity
      if (tool === 'select') {
        canvas.selection = true;
        canvas.forEachObject((obj) => {
          obj.selectable = true;
          obj.evented = true;
        });
      } else {
        canvas.selection = false;
        canvas.forEachObject((obj) => {
          // If the textbox is currently editing, we should keep it interactive
          if (obj.type === 'textbox' && (obj as any).isEditing) {
            return;
          }
          obj.selectable = false;
          obj.evented = false;
        });
      }
      canvas.requestRenderAll();
    });
  }

  ngAfterViewInit() {
    // Initialize the fabric canvas with 800x600 dimensions
    this.paintService.initializeCanvas(this.canvasRef.nativeElement, 800, 600);
    this.canvasInitialized.set(true);

    // Set up canvas event listeners for interactive shape drawing
    this.setupDrawingListeners();
  }

  ngOnDestroy() {
    this.paintService.destroyCanvas();
  }

  /**
   * Helper to identify if a tool is a shape tool
   */
  public isShapeTool(tool: PaintTool): boolean {
    return [
      'line', 'arrow', 'rect', 'rounded-rect', 'ellipse', 'triangle',
      'right-triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart'
    ].includes(tool);
  }

  /**
   * Check if a Textbox is currently being edited to avoid hijacking keyboard inputs
   */
  private isEditingText(): boolean {
    const canvas = this.paintService.canvas;
    if (!canvas) return false;
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'textbox') {
      return (activeObject as any).isEditing;
    }
    return false;
  }

  /**
   * Generates the SVG path string for a wireframe arrow from (x1, y1) to (x2, y2)
   */
  private getArrowPath(x1: number, y1: number, x2: number, y2: number): string {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 15; // length of head in pixels
    const x3 = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const y3 = y2 - headLength * Math.sin(angle - Math.PI / 6);
    const x4 = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const y4 = y2 - headLength * Math.sin(angle + Math.PI / 6);
    
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${x3} ${y3} M ${x2} ${y2} L ${x4} ${y4}`;
  }

  private getRightTrianglePath(x1: number, y1: number, x2: number, y2: number): string {
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z`;
  }

  private getDiamondPath(x1: number, y1: number, x2: number, y2: number): string {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return `M ${cx} ${y1} L ${x2} ${cy} L ${cx} ${y2} L ${x1} ${cy} Z`;
  }

  private getPentagonPath(x1: number, y1: number, x2: number, y2: number): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const w = maxX - minX;
    const h = maxY - minY;
    return `M ${minX + w/2} ${minY} L ${maxX} ${minY + h * 0.38} L ${minX + w * 0.81} ${maxY} L ${minX + w * 0.19} ${maxY} L ${minX} ${minY + h * 0.38} Z`;
  }

  private getHexagonPath(x1: number, y1: number, x2: number, y2: number): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const w = maxX - minX;
    const h = maxY - minY;
    return `M ${minX + w * 0.25} ${minY} L ${minX + w * 0.75} ${minY} L ${maxX} ${minY + h/2} L ${minX + w * 0.75} ${maxY} L ${minX + w * 0.25} ${maxY} L ${minX} ${minY + h/2} Z`;
  }

  private getStarPath(x1: number, y1: number, x2: number, y2: number): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const w = maxX - minX;
    const h = maxY - minY;
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    
    let path = '';
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const rFactor = i % 2 === 0 ? 1 : 0.4;
      const px = cx + rx * rFactor * Math.cos(angle);
      const py = cy + ry * rFactor * Math.sin(angle);
      path += (i === 0 ? 'M' : 'L') + ` ${px} ${py}`;
    }
    return path + ' Z';
  }

  private getHeartPath(x1: number, y1: number, x2: number, y2: number): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const w = maxX - minX;
    const h = maxY - minY;
    const cx = minX + w / 2;
    const yTop = minY + h * 0.3;
    const yBottom = maxY;
    
    return `M ${cx} ${yTop} 
            C ${minX + w * 0.2} ${minY} ${minX} ${minY + h * 0.2} ${minX} ${minY + h * 0.55} 
            C ${minX} ${minY + h * 0.8} ${minX + w * 0.3} ${minY + h * 0.9} ${cx} ${yBottom} 
            C ${minX + w * 0.7} ${minY + h * 0.9} ${maxX} ${minY + h * 0.8} ${maxX} ${minY + h * 0.55} 
            C ${maxX} ${minY + h * 0.2} ${minX + w * 0.8} ${minY} ${cx} ${yTop} Z`;
  }

  /**
   * Binds drawing mouse events to the Fabric canvas
   */
  private setupDrawingListeners() {
    const canvas = this.paintService.canvas;
    if (!canvas) return;

    canvas.on('mouse:down', (opt) => {
      const tool = this.paintService.activeTool();

      // Text tool: click to add textbox, enter editing, switch to select
      if (tool === 'text') {
        const pointer = canvas.getScenePoint(opt.e);
        const strokeColor = this.paintService.strokeColor();

        const textbox = new Textbox('Texte', {
          left: pointer.x,
          top: pointer.y,
          width: 150,
          fontSize: 20,
          fill: strokeColor,
          fontFamily: 'Inter, sans-serif',
          name: 'Texte',
          editable: true,
        });

        canvas.add(textbox);
        canvas.setActiveObject(textbox);
        this.paintService.syncLayers();
        this.paintService.saveState();

        setTimeout(() => {
          textbox.enterEditing();
          textbox.selectAll();
        }, 50);

        this.paintService.setTool('select');
        canvas.requestRenderAll();
        return;
      }

      // Shape drawing tools
      if (this.isShapeTool(tool)) {
        this.isDrawingShape = true;
        this.paintService.isDrawingShape = true;
        const start = canvas.getScenePoint(opt.e);
        this.startPointer = start;

        // Disable selection on all canvas objects while drawing is in progress
        canvas.selection = false;
        canvas.forEachObject((obj) => {
          obj.selectable = false;
          obj.evented = false;
        });

        const strokeColor = this.paintService.strokeColor();
        const fillColor = this.paintService.fillColor();
        const strokeWidth = this.paintService.strokeWidth();

        if (tool === 'line') {
          this.currentObject = new Line(
            [start.x, start.y, start.x, start.y],
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              name: 'Ligne',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'arrow') {
          this.currentObject = new Path(
            this.getArrowPath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: 'transparent',
              name: 'Flèche',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'rect') {
          this.currentObject = new Rect({
            left: start.x,
            top: start.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: fillColor === 'transparent' ? 'transparent' : fillColor,
            name: 'Rectangle',
            selectable: false,
            evented: false,
          });
        } else if (tool === 'rounded-rect') {
          this.currentObject = new Rect({
            left: start.x,
            top: start.y,
            width: 0,
            height: 0,
            rx: 15,
            ry: 15,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: fillColor === 'transparent' ? 'transparent' : fillColor,
            name: 'Rectangle arrondi',
            selectable: false,
            evented: false,
          });
        } else if (tool === 'ellipse') {
          this.currentObject = new Ellipse({
            left: start.x,
            top: start.y,
            rx: 0,
            ry: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: fillColor === 'transparent' ? 'transparent' : fillColor,
            name: 'Ellipse',
            selectable: false,
            evented: false,
          });
        } else if (tool === 'triangle') {
          this.currentObject = new Triangle({
            left: start.x,
            top: start.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: fillColor === 'transparent' ? 'transparent' : fillColor,
            name: 'Triangle',
            selectable: false,
            evented: false,
          });
        } else if (tool === 'right-triangle') {
          this.currentObject = new Path(
            this.getRightTrianglePath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: fillColor === 'transparent' ? 'transparent' : fillColor,
              name: 'Triangle rectangle',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'diamond') {
          this.currentObject = new Path(
            this.getDiamondPath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: fillColor === 'transparent' ? 'transparent' : fillColor,
              name: 'Losange',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'pentagon') {
          this.currentObject = new Path(
            this.getPentagonPath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: fillColor === 'transparent' ? 'transparent' : fillColor,
              name: 'Pentagone',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'hexagon') {
          this.currentObject = new Path(
            this.getHexagonPath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: fillColor === 'transparent' ? 'transparent' : fillColor,
              name: 'Hexagone',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'star') {
          this.currentObject = new Path(
            this.getStarPath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: fillColor === 'transparent' ? 'transparent' : fillColor,
              name: 'Étoile',
              selectable: false,
              evented: false,
            }
          );
        } else if (tool === 'heart') {
          this.currentObject = new Path(
            this.getHeartPath(start.x, start.y, start.x, start.y),
            {
              stroke: strokeColor,
              strokeWidth: strokeWidth,
              fill: fillColor === 'transparent' ? 'transparent' : fillColor,
              name: 'Cœur',
              selectable: false,
              evented: false,
            }
          );
        }

        if (this.currentObject) {
          canvas.add(this.currentObject);
          canvas.requestRenderAll();
        }
      }
    });

    canvas.on('mouse:move', (opt) => {
      const start = this.startPointer;
      if (!this.isDrawingShape || !start || !this.currentObject) return;

      const pointer = canvas.getScenePoint(opt.e);
      const tool = this.paintService.activeTool();
      const strokeColor = this.paintService.strokeColor();
      const fillColor = this.paintService.fillColor();
      const strokeWidth = this.paintService.strokeWidth();

      if (tool === 'line') {
        const line = this.currentObject as Line;
        line.set({
          x2: pointer.x,
          y2: pointer.y,
        });
      } else if (
        ['arrow', 'right-triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'heart'].includes(tool)
      ) {
        canvas.remove(this.currentObject);
        
        let pathStr = '';
        let name = '';
        let fill = 'transparent';

        if (tool === 'arrow') {
          pathStr = this.getArrowPath(start.x, start.y, pointer.x, pointer.y);
          name = 'Flèche';
        } else if (tool === 'right-triangle') {
          pathStr = this.getRightTrianglePath(start.x, start.y, pointer.x, pointer.y);
          name = 'Triangle rectangle';
          fill = fillColor === 'transparent' ? 'transparent' : fillColor;
        } else if (tool === 'diamond') {
          pathStr = this.getDiamondPath(start.x, start.y, pointer.x, pointer.y);
          name = 'Losange';
          fill = fillColor === 'transparent' ? 'transparent' : fillColor;
        } else if (tool === 'pentagon') {
          pathStr = this.getPentagonPath(start.x, start.y, pointer.x, pointer.y);
          name = 'Pentagone';
          fill = fillColor === 'transparent' ? 'transparent' : fillColor;
        } else if (tool === 'hexagon') {
          pathStr = this.getHexagonPath(start.x, start.y, pointer.x, pointer.y);
          name = 'Hexagone';
          fill = fillColor === 'transparent' ? 'transparent' : fillColor;
        } else if (tool === 'star') {
          pathStr = this.getStarPath(start.x, start.y, pointer.x, pointer.y);
          name = 'Étoile';
          fill = fillColor === 'transparent' ? 'transparent' : fillColor;
        } else if (tool === 'heart') {
          pathStr = this.getHeartPath(start.x, start.y, pointer.x, pointer.y);
          name = 'Cœur';
          fill = fillColor === 'transparent' ? 'transparent' : fillColor;
        }

        this.currentObject = new Path(pathStr, {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: fill,
          name: name,
          selectable: false,
          evented: false,
        });
        canvas.add(this.currentObject);
      } else {
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const width = Math.abs(pointer.x - start.x);
        const height = Math.abs(pointer.y - start.y);

        if (tool === 'rect' || tool === 'rounded-rect' || tool === 'triangle') {
          this.currentObject.set({
            left: left,
            top: top,
            width: width,
            height: height,
          });
        } else if (tool === 'ellipse') {
          const ellipse = this.currentObject as Ellipse;
          ellipse.set({
            left: left,
            top: top,
            rx: width / 2,
            ry: height / 2,
          });
        }
      }

      canvas.requestRenderAll();
    });

    canvas.on('mouse:up', () => {
      if (!this.isDrawingShape) return;

      this.isDrawingShape = false;
      let keptObject = false;

      if (this.currentObject) {
        const width = this.currentObject.width || 0;
        const height = this.currentObject.height || 0;
        const rx = (this.currentObject as any).rx || 0;
        const ry = (this.currentObject as any).ry || 0;
        
        let isTooSmall = false;
        const tool = this.paintService.activeTool();
        
        if (tool === 'line') {
          const line = this.currentObject as Line;
          isTooSmall = Math.abs(line.x2 - line.x1) < 3 && Math.abs(line.y2 - line.y1) < 3;
        } else if (tool === 'ellipse') {
          isTooSmall = rx < 1.5 && ry < 1.5;
        } else {
          isTooSmall = width < 3 && height < 3;
        }

        if (isTooSmall) {
          canvas.remove(this.currentObject);
        } else {
          // Re-enable interactivity for the new object
          this.currentObject.set({
            selectable: true,
            evented: true,
          });
          canvas.setActiveObject(this.currentObject);
          
          // Switch to select tool so the user can immediately modify the shape they just drew
          this.paintService.setTool('select');
          keptObject = true;
        }
      }

      // Re-enable selection on all objects
      canvas.selection = true;
      canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });

      // Synchronize layers and persist changes
      this.paintService.syncLayers();
      this.paintService.isDrawingShape = false;

      if (keptObject) {
        this.paintService.saveState();
      }

      this.currentObject = null;
      this.startPointer = null;

      canvas.requestRenderAll();
    });

    // Auto-promote selected layer to the top in 'select' mode
    canvas.on('selection:created', (e) => {
      if (this.paintService.activeTool() === 'select') {
        const activeObj = canvas.getActiveObject();
        if (activeObj && !(activeObj instanceof ActiveSelection)) {
          this.paintService.promoteObjectToFront(activeObj);
        }
      }
    });

    canvas.on('selection:updated', (e) => {
      if (this.paintService.activeTool() === 'select') {
        const activeObj = canvas.getActiveObject();
        if (activeObj && !(activeObj instanceof ActiveSelection)) {
          this.paintService.promoteObjectToFront(activeObj);
        }
      }
    });
  }

  /**
   * Drag & Drop File Imports
   */
  @HostListener('dragover', ['$event'])
  public onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  @HostListener('dragleave', ['$event'])
  public onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  @HostListener('drop', ['$event'])
  public onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        this.paintService.importImageFile(file);
      }
    }
  }

  /**
   * System Clipboard Paste Listener
   */
  @HostListener('window:paste', ['$event'])
  public handlePaste(event: ClipboardEvent) {
    if (this.isEditingText()) {
      return; // Let native paste handle editing textbox
    }
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            this.paintService.importImageFile(file);
            return;
          }
        }
      }
    }

    const text = event.clipboardData?.getData('text');
    if (text) {
      if (text.startsWith('stickypaint:')) {
        const parts = text.split(':');
        const type = parts[1];
        const jsonStr = parts.slice(2).join(':');
        this.paintService.pasteObject(type, jsonStr);
      } else {
        this.paintService.pasteTextAsTextbox(text);
      }
    }
  }

  // Canvas resizing state
  public isResizingCanvas = false;
  private resizeType: 'right' | 'bottom' | 'both' = 'both';
  private initialCanvasSize = { width: 800, height: 600 };
  private resizeStartPointer = { x: 0, y: 0 };

  public startResizeCanvas(event: MouseEvent, type: 'right' | 'bottom' | 'both') {
    event.preventDefault();
    event.stopPropagation();
    this.isResizingCanvas = true;
    this.resizeType = type;
    this.initialCanvasSize = { ...this.paintService.canvasSize() };
    this.resizeStartPointer = { x: event.clientX, y: event.clientY };
    
    document.addEventListener('mousemove', this.handleCanvasResizeMove);
    document.addEventListener('mouseup', this.handleCanvasResizeUp);
    
    this.paintService.statusMessage.set('Redimensionnement du canevas...');
  }

  private handleCanvasResizeMove = (event: MouseEvent) => {
    if (!this.isResizingCanvas) return;
    
    const deltaX = event.clientX - this.resizeStartPointer.x;
    const deltaY = event.clientY - this.resizeStartPointer.y;
    
    const zoom = this.paintService.zoomLevel();
    let newWidth = this.initialCanvasSize.width;
    let newHeight = this.initialCanvasSize.height;
    
    if (this.resizeType === 'right' || this.resizeType === 'both') {
      newWidth = Math.max(100, this.initialCanvasSize.width + Math.round(deltaX / zoom));
    }
    if (this.resizeType === 'bottom' || this.resizeType === 'both') {
      newHeight = Math.max(100, this.initialCanvasSize.height + Math.round(deltaY / zoom));
    }
    
    this.paintService.canvasSize.set({ width: newWidth, height: newHeight });
    
    if (this.paintService.canvas) {
      this.paintService.canvas.setDimensions({
        width: newWidth * zoom,
        height: newHeight * zoom
      });
      this.paintService.canvas.calcOffset();
      this.paintService.canvas.requestRenderAll();
    }
  };

  private handleCanvasResizeUp = () => {
    if (this.isResizingCanvas) {
      this.isResizingCanvas = false;
      document.removeEventListener('mousemove', this.handleCanvasResizeMove);
      document.removeEventListener('mouseup', this.handleCanvasResizeUp);
      
      this.paintService.statusMessage.set('Canevas redimensionné');
      this.paintService.saveState();
    }
  };

  /**
   * Ctrl + Mouse Wheel Zoom
   */
  @HostListener('wheel', ['$event'])
  public onWheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.paintService.zoomIn();
      } else {
        this.paintService.zoomOut();
      }
    }
  }

  /**
   * Keyboard Shortcuts Listener
   */
  @HostListener('window:keydown', ['$event'])
  public handleKeyDown(event: KeyboardEvent) {
    if (this.isEditingText()) {
      return;
    }

    const isCtrl = event.ctrlKey || event.metaKey;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.paintService.deleteSelected();
    } else if (isCtrl && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      this.paintService.copy();
    } else if (isCtrl && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      this.paintService.cut();
    } else if (isCtrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.paintService.undo();
    } else if (isCtrl && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.paintService.redo();
    } else if (isCtrl && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.paintService.exportPNG();
    } else if (isCtrl && (event.key === '+' || event.key === '=')) {
      event.preventDefault();
      this.paintService.zoomIn();
    } else if (isCtrl && event.key === '-') {
      event.preventDefault();
      this.paintService.zoomOut();
    } else if (isCtrl && event.key === '0') {
      event.preventDefault();
      this.paintService.resetZoom();
    }
  }
}
