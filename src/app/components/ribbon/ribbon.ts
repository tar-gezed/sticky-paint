import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaintService, PaintTool } from '../../services/paint';

@Component({
  selector: 'app-ribbon',
  imports: [CommonModule],
  templateUrl: './ribbon.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class Ribbon {
  public paintService = inject(PaintService);
  
  // Track which color target (stroke or fill) is active for palette selection
  public activeColorTarget = signal<'stroke' | 'fill'>('stroke');

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Predefined color palette (retro & modern mix)
  public colors = [
    // Row 1: Classic Retro
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    // Row 2: Pastel / Modern
    '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
    // Row 3: Brights
    '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'
  ];

  public toolsList: { id: PaintTool; name: string; icon: string; tooltip: string }[] = [
    { id: 'select', name: 'Sélection', icon: 'cursor', tooltip: 'Sélectionner et modifier des formes (V)' },
    { id: 'brush', name: 'Crayon', icon: 'pencil', tooltip: 'Pinceau de dessin libre (B)' },
    { id: 'eraser', name: 'Gomme', icon: 'eraser', tooltip: 'Gomme (E)' },
    { id: 'text', name: 'Texte', icon: 'text', tooltip: 'Ajouter une zone de texte (T)' }
  ];

  public shapesList: { id: PaintTool; name: string; icon: string; tooltip: string }[] = [
    { id: 'line', name: 'Ligne', icon: 'line', tooltip: 'Ligne droite' },
    { id: 'arrow', name: 'Flèche', icon: 'arrow', tooltip: 'Flèche directionnelle' },
    { id: 'rect', name: 'Rectangle', icon: 'rect', tooltip: 'Rectangle' },
    { id: 'rounded-rect', name: 'Rectangle arrondi', icon: 'rounded-rect', tooltip: 'Rectangle aux coins arrondis' },
    { id: 'ellipse', name: 'Ellipse', icon: 'ellipse', tooltip: 'Ellipse / Cercle' },
    { id: 'triangle', name: 'Triangle', icon: 'triangle', tooltip: 'Triangle équilatéral' },
    { id: 'right-triangle', name: 'Triangle rectangle', icon: 'right-triangle', tooltip: 'Triangle rectangle' },
    { id: 'diamond', name: 'Losange', icon: 'diamond', tooltip: 'Losange' },
    { id: 'pentagon', name: 'Pentagone', icon: 'pentagon', tooltip: 'Pentagone régulier' },
    { id: 'hexagon', name: 'Hexagone', icon: 'hexagon', tooltip: 'Hexagone régulier' },
    { id: 'star', name: 'Étoile', icon: 'star', tooltip: 'Étoile à 5 branches' },
    { id: 'heart', name: 'Cœur', icon: 'heart', tooltip: 'Cœur' }
  ];

  public selectTool(tool: PaintTool) {
    this.paintService.setTool(tool);
  }

  public setStrokeWidth(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value)) {
      this.paintService.setStrokeWidth(value);
    }
  }

  public selectColor(color: string) {
    if (this.activeColorTarget() === 'stroke') {
      this.paintService.setStrokeColor(color);
    } else {
      this.paintService.setFillColor(color);
    }
  }

  public selectTarget(target: 'stroke' | 'fill') {
    this.activeColorTarget.set(target);
  }

  public triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  public onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.paintService.importImageFile(input.files[0]);
      input.value = '';
    }
  }

  public onStrokeColorPickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.paintService.setStrokeColor(input.value);
  }

  public onFillColorPickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.paintService.setFillColor(input.value);
  }

  public clearFillColor() {
    this.paintService.setFillColor('transparent');
  }

  public copy() {
    this.paintService.copy();
  }

  public cut() {
    this.paintService.cut();
  }

  public paste() {
    this.paintService.paste();
  }

  public undo() {
    this.paintService.undo();
  }

  public redo() {
    this.paintService.redo();
  }

  public newFile() {
    this.paintService.clearCanvas();
  }

  public exportImage() {
    this.paintService.exportPNG();
  }

  public toggleSidebar() {
    this.paintService.sidebarVisible.update(v => !v);
  }

  public showHelp() {
    this.paintService.helpOpen.set(true);
  }

  public getActiveFontFamily(): string {
    const activeObj = this.paintService.canvas?.getActiveObject();
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'text')) {
      return (activeObj as any).fontFamily || 'Inter';
    }
    return 'Inter';
  }

  public getActiveFontSize(): number {
    const activeObj = this.paintService.canvas?.getActiveObject();
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'text')) {
      return (activeObj as any).fontSize || 20;
    }
    return 20;
  }

  public onFontFamilyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const font = select.value;
    const activeObj = this.paintService.canvas?.getActiveObject();
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'text')) {
      activeObj.set('fontFamily', font);
      this.paintService.canvas?.requestRenderAll();
      this.paintService.saveState();
      this.paintService.syncLayers();
    }
  }

  public onFontSizeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const size = parseInt(select.value, 10);
    if (!isNaN(size)) {
      const activeObj = this.paintService.canvas?.getActiveObject();
      if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'text')) {
        activeObj.set('fontSize', size);
        this.paintService.canvas?.requestRenderAll();
        this.paintService.saveState();
        this.paintService.syncLayers();
      }
    }
  }

  public getZoomPercent(): number {
    return Math.round(this.paintService.zoomLevel() * 100);
  }

  public isTextEditingActive(): boolean {
    const activeTool = this.paintService.activeTool();
    const selectedLayer = this.paintService.selectedLayer();
    return activeTool === 'text' || (selectedLayer !== null && (selectedLayer.type === 'textbox' || selectedLayer.type === 'text'));
  }
}
