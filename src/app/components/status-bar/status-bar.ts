import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { PaintService } from '../../services/paint';

@Component({
  selector: 'app-status-bar',
  imports: [],
  templateUrl: './status-bar.html',
  styles: `
    :host {
      display: block;
    }
  `,
})
export class StatusBar implements OnInit, OnDestroy {
  public paintService = inject(PaintService);

  // Tracks the network status
  public isOnline = signal<boolean>(typeof window !== 'undefined' ? window.navigator.onLine : true);

  private readonly onlineHandler = () => this.isOnline.set(true);
  private readonly offlineHandler = () => this.isOnline.set(false);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  public getZoomPercent(): number {
    return Math.round(this.paintService.zoomLevel() * 100);
  }

  public onZoomSliderChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value)) {
      this.paintService.setZoom(value);
    }
  }
}
