import { Injectable, signal } from '@angular/core';
import { 
  Canvas, 
  FabricObject, 
  FabricImage, 
  Textbox, 
  Rect, 
  Ellipse, 
  Triangle, 
  Line, 
  Path,
  PencilBrush,
  ActiveSelection,
  Point
} from 'fabric';

// Register custom properties for JSON serialization in Fabric v6
FabricObject.customProperties = ['name', 'id', 'visible'];

export type PaintTool = 
  | 'select' 
  | 'brush' 
  | 'eraser' 
  | 'text' 
  | 'line' 
  | 'arrow' 
  | 'rect' 
  | 'rounded-rect'
  | 'ellipse' 
  | 'triangle'
  | 'right-triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'heart';

@Injectable({
  providedIn: 'root',
})
export class PaintService {
  // Canvas reference
  public canvas: Canvas | null = null;

  // Configuration Signals
  public activeTool = signal<PaintTool>('select');
  public strokeColor = signal<string>('#000000');
  public fillColor = signal<string>('transparent');
  public strokeWidth = signal<number>(5);
  public canvasBackground = signal<string>('#ffffff');
  public hasBgImage = signal<boolean>(false);
  public sidebarVisible = signal<boolean>(true);
  public helpOpen = signal<boolean>(false);
  public zoomLevel = signal<number>(1);
  public gridEnabled = signal<boolean>(false);
  public crtFilterEnabled = signal<boolean>(false);
  public isDrawingShape = false;

  // Stacking & Selection Signals
  public layers = signal<FabricObject[]>([]);
  public selectedLayer = signal<FabricObject | null>(null);

  // History Signals
  public canUndo = signal<boolean>(false);
  public canRedo = signal<boolean>(false);

  // Status Signals
  public cursorPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  public canvasSize = signal<{ width: number; height: number }>({ width: 800, height: 600 });
  public statusMessage = signal<string>('Prêt');

  // Internal History Stacks (Store JSON strings)
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private isApplyingHistory = false;

  // Local Clipboard
  private copiedObjectJson: string | null = null;
  private copiedObjectType: string | null = null;

  constructor() {
    // Register custom serialization properties globally for Fabric.js v6
    FabricObject.customProperties = ['name', 'id', 'visible'];
  }

  /**
   * Initializes the Fabric.js canvas
   */
  public initializeCanvas(canvasElement: HTMLCanvasElement, containerWidth: number, containerHeight: number) {
    this.canvasSize.set({ width: containerWidth, height: containerHeight });

    this.canvas = new Canvas(canvasElement, {
      width: containerWidth,
      height: containerHeight,
      backgroundColor: this.canvasBackground(),
      preserveObjectStacking: true, // Crucial for manual layer sorting
    });

    // Configure selection style
    FabricObject.ownDefaults.cornerColor = '#3b82f6'; // Modern Blue
    FabricObject.ownDefaults.cornerStrokeColor = '#1d4ed8';
    FabricObject.ownDefaults.cornerStyle = 'circle';
    FabricObject.ownDefaults.cornerSize = 8;
    FabricObject.ownDefaults.transparentCorners = false;
    FabricObject.ownDefaults.borderColor = '#3b82f6';
    FabricObject.ownDefaults.borderScaleFactor = 1.5;

    // Bind canvas events
    this.bindCanvasEvents();

    // Load auto-save or initialize blank state
    this.loadSavedStateOrInitBlank();
  }

  /**
   * Cleans up canvas event listeners and reference
   */
  public destroyCanvas() {
    if (this.canvas) {
      this.canvas.dispose();
      this.canvas = null;
    }
  }

  /**
   * Binds the necessary events to synchronize canvas state with signals
   */
  private bindCanvasEvents() {
    if (!this.canvas) return;

    this.canvas.on('object:added', () => {
      this.syncLayers();
      if (!this.isApplyingHistory && !this.isDrawingShape && !this.canvas?.isDrawingMode) {
        this.saveState();
      }
    });

    this.canvas.on('object:removed', () => {
      this.syncLayers();
      if (!this.isApplyingHistory && !this.isDrawingShape) {
        this.saveState();
      }
    });

    this.canvas.on('object:modified', () => {
      this.syncLayers();
      if (!this.isApplyingHistory) {
        this.saveState();
      }
    });

    this.canvas.on('selection:created', (e) => {
      this.selectedLayer.set(this.canvas?.getActiveObject() || null);
    });

    this.canvas.on('selection:updated', (e) => {
      this.selectedLayer.set(this.canvas?.getActiveObject() || null);
    });

    this.canvas.on('selection:cleared', () => {
      this.selectedLayer.set(null);
    });

    this.canvas.on('path:created', () => {
      // Called when pencil brush stroke completes
      // Let's set a name on the new path object
      const objects = this.canvas?.getObjects() || [];
      if (objects.length > 0) {
        const lastObject = objects[objects.length - 1];
        if (!lastObject.get('name')) {
          const currentTool = this.activeTool();
          const name = currentTool === 'eraser' ? 'Gomme' : `Pinceau (${lastObject.stroke})`;
          lastObject.set('name', name);
        }
      }
      this.syncLayers();
      if (!this.isApplyingHistory) {
        this.saveState();
      }
    });

    // Track mouse position on canvas
    this.canvas.on('mouse:move', (opt) => {
      if (!this.canvas) return;
      const pointer = this.canvas.getScenePoint(opt.e);
      this.cursorPosition.set({
        x: Math.max(0, Math.round(pointer.x)),
        y: Math.max(0, Math.round(pointer.y)),
      });
    });
  }

  /**
   * Sets the active drawing/selection tool
   */
  public setTool(tool: PaintTool) {
    this.activeTool.set(tool);
    if (!this.canvas) return;

    // Discard active selections if moving to drawing/shape modes
    if (tool !== 'select') {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }

    // Configure brushes
    if (tool === 'brush') {
      this.canvas.isDrawingMode = true;
      const brush = new PencilBrush(this.canvas);
      brush.width = this.strokeWidth();
      brush.color = this.strokeColor();
      this.canvas.freeDrawingBrush = brush;
      this.statusMessage.set('Dessin libre (Pinceau)');
    } else if (tool === 'eraser') {
      this.canvas.isDrawingMode = true;
      const brush = new PencilBrush(this.canvas);
      brush.width = this.strokeWidth() * 2; // Eraser is slightly wider
      brush.color = this.canvasBackground(); // Erases with background color
      this.canvas.freeDrawingBrush = brush;
      this.statusMessage.set('Gomme (Dessine en blanc/fond)');
    } else {
      this.canvas.isDrawingMode = false;
      this.statusMessage.set(this.getToolStatusText(tool));
    }
  }

  private getToolStatusText(tool: PaintTool): string {
    switch (tool) {
      case 'select': return 'Sélection et déplacement';
      case 'text': return 'Ajouter du texte (cliquez pour insérer)';
      case 'line': return 'Dessiner une ligne';
      case 'arrow': return 'Dessiner une flèche';
      case 'rect': return 'Dessiner un rectangle';
      case 'ellipse': return 'Dessiner une ellipse';
      case 'triangle': return 'Dessiner un triangle';
      default: return 'Prêt';
    }
  }

  /**
   * Set stroke parameters dynamically
   */
  public setStrokeColor(color: string) {
    this.strokeColor.set(color);
    if (this.canvas && this.canvas.isDrawingMode && this.activeTool() === 'brush') {
      if (this.canvas.freeDrawingBrush) {
        this.canvas.freeDrawingBrush.color = color;
      }
    }
    // Update active object stroke color if applicable
    const activeObj = this.canvas?.getActiveObject();
    if (activeObj && activeObj.type !== 'image') {
      if (activeObj.type === 'textbox' || activeObj.type === 'text') {
        activeObj.set('fill', color);
      } else {
        activeObj.set('stroke', color);
      }
      this.canvas?.requestRenderAll();
      this.saveState();
      this.syncLayers();
    }
  }

  public setFillColor(color: string) {
    this.fillColor.set(color);
    const activeObj = this.canvas?.getActiveObject();
    if (activeObj && activeObj.type !== 'image' && activeObj.type !== 'path') {
      if (activeObj.type === 'textbox' || activeObj.type === 'text') {
        activeObj.set('textBackgroundColor', color === 'transparent' ? 'transparent' : color);
      } else {
        activeObj.set('fill', color === 'transparent' ? 'transparent' : color);
      }
      this.canvas?.requestRenderAll();
      this.saveState();
      this.syncLayers();
    }
  }

  public setStrokeWidth(width: number) {
    this.strokeWidth.set(width);
    if (this.canvas && this.canvas.isDrawingMode) {
      if (this.canvas.freeDrawingBrush) {
        this.canvas.freeDrawingBrush.width = this.activeTool() === 'eraser' ? width * 2 : width;
      }
    }
    const activeObj = this.canvas?.getActiveObject();
    if (activeObj && activeObj.type !== 'image') {
      activeObj.set('strokeWidth', width);
      this.canvas?.requestRenderAll();
      this.saveState();
    }
  }

  /**
   * Set background color of the canvas
   */
  public setBackgroundColor(color: string) {
    this.canvasBackground.set(color);
    if (!this.canvas) return;
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
    this.saveState();
  }

  /**
   * Synchronizes the layer list signal from the canvas objects
   */
  public syncLayers() {
    if (!this.canvas) return;
    const objects = this.canvas.getObjects();
    
    // Generate base64 previews for layers (throttled on state changes)
    objects.forEach((obj) => {
      try {
        const width = obj.width * obj.scaleX;
        const height = obj.height * obj.scaleY;
        const maxDim = Math.max(width, height, 1);
        const multiplier = 36 / maxDim; // Keep thumbnail small (approx 36px bounding box)
        
        (obj as any)._thumbnail = obj.toDataURL({
          format: 'png',
          multiplier: Math.min(1.0, multiplier),
        });
      } catch (e) {
        (obj as any)._thumbnail = null;
      }
    });

    // Reverse layer order so the top-most object is at index 0 in our list
    this.layers.set([...objects].reverse());
    this.selectedLayer.set(this.canvas.getActiveObject() || null);
  }

  /**
   * Moves a layer from one index to another (cdk-drag-drop reordering)
   */
  public moveLayer(fromIndex: number, toIndex: number) {
    if (!this.canvas) return;
    const objects = this.canvas.getObjects();
    
    // Convert UI list indices (reverse order) back to Fabric.js indices
    const fabricFromIndex = objects.length - 1 - fromIndex;
    const fabricToIndex = objects.length - 1 - toIndex;
    
    const obj = objects[fabricFromIndex];
    if (obj) {
      this.canvas.moveObjectTo(obj, fabricToIndex);
      this.canvas.requestRenderAll();
      this.syncLayers();
      this.saveState();
    }
  }

  /**
   * Toggles visibility of a specific layer
   */
  public toggleLayerVisibility(obj: FabricObject) {
    if (!this.canvas) return;
    obj.set('visible', !obj.visible);
    
    // Discard selection if the object becomes invisible
    if (!obj.visible && this.canvas.getActiveObject() === obj) {
      this.canvas.discardActiveObject();
    }
    
    this.canvas.requestRenderAll();
    this.syncLayers();
    this.saveState();
  }

  /**
   * Deletes a specific layer
   */
  public deleteLayer(obj: FabricObject) {
    if (!this.canvas) return;
    this.canvas.remove(obj);
    if (this.canvas.getActiveObject() === obj) {
      this.canvas.discardActiveObject();
    }
    this.canvas.requestRenderAll();
    this.syncLayers();
    this.saveState();
  }

  /**
   * Manually creates a new Textbox layer
   */
  public createNewLayer() {
    if (!this.canvas) return;
    const center = this.canvas.getCenterPoint();
    const newText = new Textbox('Nouveau calque', {
      left: center.x - 70,
      top: center.y - 15,
      width: 140,
      fontSize: 20,
      fill: this.strokeColor(),
      fontFamily: 'Inter, sans-serif',
      name: 'Texte: Nouveau calque',
      editable: true
    });
    
    this.canvas.add(newText);
    this.canvas.setActiveObject(newText);
    this.canvas.requestRenderAll();
    this.saveState();
  }

  /**
   * Promotes clicked object to front automatically (Zero-friction)
   */
  public promoteObjectToFront(obj: FabricObject) {
    if (!this.canvas || !obj) return;
    // Don't re-promote if already active and on top
    const objects = this.canvas.getObjects();
    if (objects[objects.length - 1] === obj) return;

    this.canvas.bringObjectToFront(obj);
    this.canvas.requestRenderAll();
    this.syncLayers();
    // We save state because stacking order changed
    this.saveState();
  }

  /**
   * Clipboard Operations
   */
  /**
   * Clipboard Operations
   */
  public async copy() {
    if (!this.canvas) return;
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // Serialize object to JSON and cache type
    this.copiedObjectJson = JSON.stringify(activeObj.toJSON());
    this.copiedObjectType = activeObj.type;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`stickypaint:${this.copiedObjectType}:${this.copiedObjectJson}`);
      }
    } catch (e) {
      console.warn('Could not write to system clipboard:', e);
    }

    this.statusMessage.set('Objet copié');
  }

  public async cut() {
    if (!this.canvas) return;
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    await this.copy();
    this.canvas.remove(activeObj);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.statusMessage.set('Objet coupé');
    this.syncLayers();
    this.saveState();
  }

  public async paste() {
    if (!this.canvas) return;

    try {
      // 1. Try reading from system clipboard (files/images first)
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const file = new File([blob], 'pasted-image.png', { type });
                this.importImageFile(file);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Navigator clipboard.read failed, trying readText:', e);
        }
      }

      // 2. Try reading from system clipboard text
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            if (text.startsWith('stickypaint:')) {
              const parts = text.split(':');
              const type = parts[1];
              const jsonStr = parts.slice(2).join(':');
              await this.pasteObject(type, jsonStr);
              return;
            } else {
              this.pasteTextAsTextbox(text);
              return;
            }
          }
        } catch (e) {
          console.warn('Navigator clipboard.readText failed, falling back to local cache:', e);
        }
      }
    } catch (e) {
      console.warn('Navigator clipboard API error:', e);
    }

    // 3. Fallback to local clipboard cache
    if (this.copiedObjectJson && this.copiedObjectType) {
      await this.pasteObject(this.copiedObjectType, this.copiedObjectJson);
    }
  }

  public pasteTextAsTextbox(text: string) {
    if (!this.canvas) return;
    const center = this.canvas.getCenterPoint();
    const textbox = new Textbox(text, {
      left: center.x - 75,
      top: center.y - 15,
      width: 150,
      fontSize: 20,
      fill: this.strokeColor(),
      fontFamily: 'Inter, sans-serif',
      name: 'Texte',
      editable: true,
    });
    this.canvas.add(textbox);
    this.canvas.setActiveObject(textbox);
    this.canvas.requestRenderAll();
    this.syncLayers();
    this.saveState();
    this.statusMessage.set('Texte collé');
  }

  public async pasteObject(type: string, jsonStr: string) {
    if (!this.canvas) return;
    try {
      const parsedJson = JSON.parse(jsonStr);
      parsedJson.left = (parsedJson.left || 0) + 20;
      parsedJson.top = (parsedJson.top || 0) + 20;

      let pastedObj: FabricObject;

      if (type === 'rect') {
        pastedObj = new Rect(parsedJson);
      } else if (type === 'circle' || type === 'ellipse') {
        pastedObj = new Ellipse(parsedJson);
      } else if (type === 'triangle') {
        pastedObj = new Triangle(parsedJson);
      } else if (type === 'textbox' || type === 'text') {
        pastedObj = new Textbox(parsedJson.text || '', parsedJson);
      } else if (type === 'line') {
        pastedObj = new Line([parsedJson.x1, parsedJson.y1, parsedJson.x2, parsedJson.y2], parsedJson);
      } else if (type === 'path') {
        pastedObj = new Path(parsedJson.path, parsedJson);
      } else if (type === 'image') {
        const imgElement = document.createElement('img');
        imgElement.src = parsedJson.src;
        await new Promise((resolve) => {
          imgElement.onload = resolve;
        });
        pastedObj = new FabricImage(imgElement, parsedJson);
      } else {
        pastedObj = new Rect(parsedJson);
      }

      this.canvas.add(pastedObj);
      this.canvas.setActiveObject(pastedObj);
      this.canvas.requestRenderAll();
      this.syncLayers();
      this.saveState();
      this.statusMessage.set('Objet collé');
    } catch (err) {
      console.error('Error pasting object:', err);
    }
  }

  public deleteSelected() {
    if (!this.canvas) return;
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj instanceof ActiveSelection) {
      activeObj.forEachObject((obj) => {
        this.canvas?.remove(obj);
      });
      this.canvas.discardActiveObject();
    } else {
      this.canvas.remove(activeObj);
      this.canvas.discardActiveObject();
    }
    
    this.canvas.requestRenderAll();
    this.statusMessage.set('Sélection supprimée');
  }

  /**
   * Imports an image file into the canvas
   */
  public importImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await this.importImageFromDataUrl(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Loads image data URL and adds it as an object
   */
  public async importImageFromDataUrl(dataUrl: string, fileName: string) {
    if (!this.canvas) return;

    this.statusMessage.set("Chargement de l'image...");
    try {
      // In Fabric.js v6, FabricImage.fromURL is promise-based
      const img = await FabricImage.fromURL(dataUrl);
      
      const center = this.canvas.getCenterPoint();
      
      // Calculate scaling to fit the canvas nicely
      const maxW = this.canvasSize().width * 0.7;
      const maxH = this.canvasSize().height * 0.7;
      let scale = 1;

      if (img.width > maxW || img.height > maxH) {
        scale = Math.min(maxW / img.width, maxH / img.height);
      }

      img.set({
        left: center.x - (img.width * scale) / 2,
        top: center.y - (img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        name: `Image: ${fileName.substring(0, 15)}...`,
      });

      this.canvas.add(img);
      this.canvas.setActiveObject(img);
      this.canvas.requestRenderAll();
      this.statusMessage.set('Image importée avec succès');
      this.saveState();
    } catch (err) {
      console.error('Error importing image:', err);
      this.statusMessage.set("Échec de l'importation de l'image");
    }
  }

  /**
   * Zoom controls
   */
  public setZoom(level: number) {
    const clamped = Math.max(0.125, Math.min(8, level));
    this.zoomLevel.set(clamped);
    this.statusMessage.set(`Zoom : ${Math.round(clamped * 100)}%`);
    
    if (this.canvas) {
      this.canvas.setZoom(clamped);
      this.canvas.setDimensions({
        width: this.canvasSize().width * clamped,
        height: this.canvasSize().height * clamped
      });
      this.canvas.calcOffset();
      this.canvas.requestRenderAll();
    }
  }

  public zoomIn() {
    const current = this.zoomLevel();
    const steps = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
    const nextStep = steps.find(s => s > current);
    if (nextStep !== undefined) {
      this.setZoom(nextStep);
    } else if (current < 8) {
      this.setZoom(current + 1);
    }
  }

  public zoomOut() {
    const current = this.zoomLevel();
    const steps = [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];
    const prevStep = [...steps].reverse().find(s => s < current);
    if (prevStep !== undefined) {
      this.setZoom(prevStep);
    } else if (current > 0.125) {
      this.setZoom(current - 0.5);
    }
  }

  public resetZoom() {
    this.setZoom(1);
  }

  /**
   * Rotates the entire canvas 90 degrees clockwise
   */
  public rotateCanvas90() {
    if (!this.canvas) return;

    // Discard selection first
    this.canvas.discardActiveObject();

    const oldWidth = this.canvasSize().width;
    const oldHeight = this.canvasSize().height;
    
    const newWidth = oldHeight;
    const newHeight = oldWidth;

    const cx_old = oldWidth / 2;
    const cy_old = oldHeight / 2;
    const cx_new = newWidth / 2;
    const cy_new = newHeight / 2;

    const objects = this.canvas.getObjects();

    objects.forEach((obj) => {
      const objCenter = obj.getCenterPoint();

      // Math: rotate (dx, dy) 90 deg clockwise -> (-dy, dx)
      const rotatedX = cx_new - (objCenter.y - cy_old);
      const rotatedY = cy_new + (objCenter.x - cx_old);

      obj.setPositionByOrigin(new Point(rotatedX, rotatedY), 'center', 'center');
      obj.angle = ((obj.angle || 0) + 90) % 360;
      obj.setCoords();
    });

    // Update canvas sizes
    this.canvasSize.set({ width: newWidth, height: newHeight });
    
    // Apply zoom scaling to the canvas dimensions
    const zoom = this.zoomLevel();
    this.canvas.setZoom(zoom);
    this.canvas.setDimensions({
      width: newWidth * zoom,
      height: newHeight * zoom
    });
    
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();

    this.syncLayers();
    this.saveState();
    this.statusMessage.set('Canevas pivoté de 90° (horaire)');
  }

  /**
   * Rotates the entire canvas 90 degrees counter-clockwise
   */
  public rotateCanvas90CounterClockwise() {
    if (!this.canvas) return;

    // Discard selection first
    this.canvas.discardActiveObject();

    const oldWidth = this.canvasSize().width;
    const oldHeight = this.canvasSize().height;
    
    const newWidth = oldHeight;
    const newHeight = oldWidth;

    const cx_old = oldWidth / 2;
    const cy_old = oldHeight / 2;
    const cx_new = newWidth / 2;
    const cy_new = newHeight / 2;

    const objects = this.canvas.getObjects();

    objects.forEach((obj) => {
      const objCenter = obj.getCenterPoint();

      // Math: rotate (dx, dy) 90 deg CCW -> (dy, -dx)
      const rotatedX = cx_new + (objCenter.y - cy_old);
      const rotatedY = cy_new - (objCenter.x - cx_old);

      obj.setPositionByOrigin(new Point(rotatedX, rotatedY), 'center', 'center');
      obj.angle = ((obj.angle || 0) - 90 + 360) % 360;
      obj.setCoords();
    });

    // Update canvas sizes
    this.canvasSize.set({ width: newWidth, height: newHeight });
    
    // Apply zoom scaling to the canvas dimensions
    const zoom = this.zoomLevel();
    this.canvas.setZoom(zoom);
    this.canvas.setDimensions({
      width: newWidth * zoom,
      height: newHeight * zoom
    });
    
    this.canvas.calcOffset();
    this.canvas.requestRenderAll();

    this.syncLayers();
    this.saveState();
    this.statusMessage.set('Canevas pivoté de 90° (antihoraire)');
  }

  /**
   * Undo/Redo State Management
   */
  public saveState() {
    if (!this.canvas) return;

    // Serialize including custom property 'name' and default visibility/id
    // Override serialized dimensions to be logical width/height (100% zoom)
    const stateObj = this.canvas.toJSON();
    stateObj.width = this.canvasSize().width;
    stateObj.height = this.canvasSize().height;
    const json = JSON.stringify(stateObj);
    
    // Avoid double entries
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === json) {
      return;
    }

    this.undoStack.push(json);
    this.redoStack = []; // Clear redo stack on action

    // Cap history
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }

    this.updateHistorySignals();
    this.autoSaveToLocalStorage(json);
  }

  public async undo() {
    if (this.undoStack.length <= 1 || !this.canvas) return;

    this.isApplyingHistory = true;
    this.statusMessage.set('Annuler...');

    const current = this.undoStack.pop();
    if (current) {
      this.redoStack.push(current);
    }

    const prevStateJson = this.undoStack[this.undoStack.length - 1];
    
    try {
      const stateObj = JSON.parse(prevStateJson);
      // Remove viewportTransform so history operations don't override the current zoom/pan state
      delete stateObj.viewportTransform;

      await this.canvas.loadFromJSON(stateObj);
      
      const loadedWidth = stateObj.width || 800;
      const loadedHeight = stateObj.height || 600;
      this.canvasSize.set({ width: loadedWidth, height: loadedHeight });
      
      const zoom = this.zoomLevel();
      this.canvas.setZoom(zoom);
      this.canvas.setDimensions({
        width: loadedWidth * zoom,
        height: loadedHeight * zoom
      });
      
      this.canvas.calcOffset();
      this.canvas.requestRenderAll();
      this.syncLayers();
      this.updateHistorySignals();
      this.autoSaveToLocalStorage(prevStateJson);
    } catch (err) {
      console.error('Error during Undo:', err);
    } finally {
      this.isApplyingHistory = false;
      this.statusMessage.set('Annulé');
    }
  }

  public async redo() {
    if (this.redoStack.length === 0 || !this.canvas) return;

    this.isApplyingHistory = true;
    this.statusMessage.set('Rétablir...');

    const nextStateJson = this.redoStack.pop();
    if (nextStateJson) {
      this.undoStack.push(nextStateJson);
      
      try {
        const stateObj = JSON.parse(nextStateJson);
        // Remove viewportTransform so history operations don't override the current zoom/pan state
        delete stateObj.viewportTransform;

        await this.canvas.loadFromJSON(stateObj);
        
        const loadedWidth = stateObj.width || 800;
        const loadedHeight = stateObj.height || 600;
        this.canvasSize.set({ width: loadedWidth, height: loadedHeight });
        
        const zoom = this.zoomLevel();
        this.canvas.setZoom(zoom);
        this.canvas.setDimensions({
          width: loadedWidth * zoom,
          height: loadedHeight * zoom
        });
        
        this.canvas.calcOffset();
        this.canvas.requestRenderAll();
        this.syncLayers();
        this.updateHistorySignals();
        this.autoSaveToLocalStorage(nextStateJson);
      } catch (err) {
        console.error('Error during Redo:', err);
      }
    }

    this.isApplyingHistory = false;
    this.statusMessage.set('Rétabli');
  }

  private updateHistorySignals() {
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(this.redoStack.length > 0);
  }

  /**
   * LocalStorage Auto-save
   */
  private autoSaveToLocalStorage(jsonStr: string) {
    try {
      localStorage.setItem('stickypaint_save', jsonStr);
      localStorage.setItem('stickypaint_bg', this.canvasBackground());
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  private async loadSavedStateOrInitBlank() {
    if (!this.canvas) return;

    const savedState = localStorage.getItem('stickypaint_save');
    const savedBg = localStorage.getItem('stickypaint_bg');

    if (savedBg) {
      this.canvasBackground.set(savedBg);
      this.canvas.backgroundColor = savedBg;
    }

    if (savedState) {
      try {
        this.isApplyingHistory = true;
        const stateObj = JSON.parse(savedState);
        // Remove viewportTransform so history operations don't override the current zoom/pan state
        delete stateObj.viewportTransform;

        await this.canvas.loadFromJSON(stateObj);
        
        const loadedWidth = stateObj.width || 800;
        const loadedHeight = stateObj.height || 600;
        this.canvasSize.set({ width: loadedWidth, height: loadedHeight });
        
        const zoom = this.zoomLevel();
        this.canvas.setZoom(zoom);
        this.canvas.setDimensions({
          width: loadedWidth * zoom,
          height: loadedHeight * zoom
        });
        
        this.canvas.calcOffset();
        this.canvas.requestRenderAll();
        this.syncLayers();
        
        // Setup initial history with loaded state
        this.undoStack = [savedState];
        this.redoStack = [];
        this.updateHistorySignals();
        this.statusMessage.set('Dernier projet restauré');
      } catch (e) {
        console.error('Failed to parse auto-save state, creating blank canvas', e);
        this.initBlankCanvasState();
      } finally {
        this.isApplyingHistory = false;
      }
    } else {
      this.initBlankCanvasState();
    }
  }

  private initBlankCanvasState() {
    if (!this.canvas) return;
    this.canvas.clear();
    this.canvas.backgroundColor = this.canvasBackground();
    
    const zoom = this.zoomLevel();
    const size = this.canvasSize();
    this.canvas.setZoom(zoom);
    this.canvas.setDimensions({
      width: size.width * zoom,
      height: size.height * zoom
    });
    
    this.canvas.requestRenderAll();
    this.syncLayers();

    // Push initial blank state
    // Override serialized dimensions to be logical width/height (100% zoom)
    const stateObj = this.canvas.toJSON();
    stateObj.width = size.width;
    stateObj.height = size.height;
    const json = JSON.stringify(stateObj);
    
    this.undoStack = [json];
    this.redoStack = [];
    this.updateHistorySignals();
  }

  /**
   * Reset the workspace
   */
  public clearCanvas() {
    if (confirm('Voulez-vous vraiment effacer tout le dessin ?')) {
      this.initBlankCanvasState();
      this.saveState();
      this.statusMessage.set('Nouveau canevas créé');
    }
  }

  /**
   * Export flattening PNG download
   */
  public exportPNG() {
    if (!this.canvas) return;

    // Deselect active object to avoid controls in export
    const active = this.canvas.getActiveObject();
    if (active) {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }

    // Exporter
    const dataUrl = this.canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1
    });

    // Re-select if there was an active object
    if (active) {
      this.canvas.setActiveObject(active);
      this.canvas.requestRenderAll();
    }

    // Download trigger
    const link = document.createElement('a');
    link.download = `stickypaint-${new Date().toISOString().slice(0,10)}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.statusMessage.set('Image exportée PNG avec succès');
  }
}
