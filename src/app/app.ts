import { Component, ElementRef, ViewChild, inject, effect } from '@angular/core';
import { Ribbon } from './components/ribbon/ribbon';
import { Workspace } from './components/workspace/workspace';
import { Sidebar } from './components/sidebar/sidebar';
import { StatusBar } from './components/status-bar/status-bar';
import { PaintService } from './services/paint';

@Component({
  selector: 'app-root',
  imports: [Ribbon, Workspace, Sidebar, StatusBar],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  public paintService = inject(PaintService);

  @ViewChild('helpDialog') helpDialog!: ElementRef<HTMLDialogElement>;

  constructor() {
    // Watch helpOpen signal to open/close the dialog modal
    effect(() => {
      const isOpen = this.paintService.helpOpen();
      const dialog = this.helpDialog?.nativeElement;
      if (!dialog) return;

      if (isOpen) {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else {
        if (dialog.open) {
          dialog.close();
        }
      }
    });
  }

  ngAfterViewInit() {
    const dialog = this.helpDialog?.nativeElement;
    if (dialog && !('closedBy' in HTMLDialogElement.prototype)) {
      // Fallback for browsers without closedby support
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (!isDialogContent) {
          this.closeHelp();
        }
      });
    }
  }

  public closeHelp() {
    this.paintService.helpOpen.set(false);
  }

  public onHelpClose() {
    // Sync status if closed via Esc key
    this.paintService.helpOpen.set(false);
  }
}
