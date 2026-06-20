import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragDrop } from '@angular/cdk/drag-drop';
import { PaintService } from '../../services/paint';
import { FabricObject } from 'fabric';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './sidebar.html',
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .cdk-drag-preview {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      opacity: 0.9;
      transform: scale(1.02);
      cursor: grabbing;
      border: 1px solid rgba(59, 130, 246, 0.4);
      background: white;
    }
    .cdk-drag-placeholder {
      opacity: 0.2;
      border: 2px dashed rgba(59, 130, 246, 0.4);
      background: rgba(59, 130, 246, 0.05);
    }
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drop-list-dragging .cdk-drag {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class Sidebar {
  public paintService = inject(PaintService);

  public getThumbnail(layer: any): string | null {
    return layer._thumbnail || null;
  }

  /**
   * Handles dropping of a layer to reorder
   */
  public onDrop(event: CdkDragDrop<FabricObject[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      this.paintService.moveLayer(event.previousIndex, event.currentIndex);
    }
  }

  /**
   * Helper to determine display name for a layer
   */
  public getLayerName(layer: FabricObject): string {
    const name = layer.get('name');
    if (name) return name;

    const type = layer.type;
    switch (type) {
      case 'image': return 'Image';
      case 'textbox':
      case 'text': return 'Zone de texte';
      case 'rect': return 'Rectangle';
      case 'ellipse':
      case 'circle': return 'Ellipse';
      case 'triangle': return 'Triangle';
      case 'line': return 'Ligne';
      case 'path': return 'Pinceau';
      default: return 'Objet';
    }
  }

  /**
   * Helper to check if a layer is currently selected
   */
  public isSelected(layer: FabricObject): boolean {
    const selected = this.paintService.selectedLayer();
    if (!selected) return false;
    if (selected === layer) return true;
    if (selected.type === 'activeSelection') {
      const activeSel = selected as any;
      if (typeof activeSel.getObjects === 'function') {
        return activeSel.getObjects().includes(layer);
      }
    }
    return false;
  }

  /**
   * Selects a layer on the fabric canvas
   */
  public selectLayer(layer: FabricObject, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Don't select if the click is on an action button (visibility or delete)
    if (target.closest('.action-btn')) {
      return;
    }

    if (!this.paintService.canvas) return;

    // Only select if the layer is visible
    if (!layer.visible) return;

    this.paintService.canvas.setActiveObject(layer);
    this.paintService.canvas.requestRenderAll();
    this.paintService.syncLayers();
  }
}
