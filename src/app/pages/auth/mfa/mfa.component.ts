import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService, LoginRequest } from '../../../services/auth.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-mfa',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    CardModule,
    DividerModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="mfa-container">
      <p-card>
        <ng-template pTemplate="header">
          <div class="text-center p-4">
            <h2 class="mt-2">Autenticación</h2>
          </div>
        </ng-template>

        <!-- Mostrar QR si es primera vez -->
        <div *ngIf="showQRCode" class="text-center">
          <p>Escanea este código QR con Google Authenticator</p>

          <div class="qr-container mb-4">
            <img
              [src]="qrCodeDataUrl"
              alt="QR Code"
              class="qr-image"
              *ngIf="qrCodeDataUrl"
            />
          </div>

          <p-divider></p-divider>

          <div class="mt-4">
            <h4>Ingresa el código de 6 dígitos de tu aplicación:</h4>
          </div>
        </div>

        <!-- Solo solicitar código MFA -->
        <div *ngIf="!showQRCode" class="text-center">
          <h3>Código de Verificación</h3>
          <p>Ingresa aquí el código de autenticación:</p>
        </div>

        <!-- Campo de código -->
        <div class="p-inputgroup mt-4 mb-3">
          <span class="p-inputgroup-addon">
            <i class="pi pi-shield"></i>
          </span>
          <input
            type="text"
            pInputText
            [(ngModel)]="mfaCode"
            placeholder="Código de 6 dígitos"
            maxlength="6"
            class="text-center"
            (keyup.enter)="onVerifyMFA()"
          />
        </div>

        <!-- Botones -->
        <div class="button-group mt-3">
          <p-button
            label="Verificar"
            icon="pi pi-check"
            styleClass="p-button-success custom-btn"
            [loading]="loading"
            (onClick)="onVerifyMFA()"
            [disabled]="!mfaCode || mfaCode.length !== 6"
          ></p-button>

          <p-button
            label="Cancelar"
            icon="pi pi-times"
            styleClass="p-button-danger custom-btn"
            (onClick)="onCancel()"
          ></p-button>
        </div>
      </p-card>
    </div>
  `,
  styles: [`
    .mfa-container {
      max-width: 500px;
      margin: 2rem auto;
    }

    .qr-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .qr-image {
      max-width: 200px;
      height: auto;
    }

    .button-group {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    @media (min-width: 480px) {
      .button-group {
        flex-direction: row;
        justify-content: space-between;
      }
    }

    ::ng-deep .custom-btn {
      width: 100%;
      font-weight: 600;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      transition: all 0.3s ease;
    }

    ::ng-deep .custom-btn:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .text-center {
      text-align: center;
    }

    .mt-2 { margin-top: 0.5rem; }
    .mt-3 { margin-top: 1rem; }
    .mt-4 { margin-top: 1.5rem; }

    .mb-3 { margin-bottom: 1rem; }
    .mb-4 { margin-bottom: 1.5rem; }
  `]
})
export class MfaComponent implements OnInit, OnChanges {
  @Input() showQRCode: boolean = false;
  @Input() qrCodeUrl: string = '';
  @Input() backupCodes: string[] = [];
  @Input() email: string = '';
  @Input() password: string = '';

  @Output() mfaVerified = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  mfaCode: string = '';
  loading: boolean = false;
  qrCodeDataUrl: string = '';

  constructor(
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.generateQRCode();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['qrCodeUrl'] && this.qrCodeUrl) {
      this.generateQRCode();
    }
  }

  async generateQRCode() {
    if (this.qrCodeUrl && this.showQRCode) {
      try {
        this.qrCodeDataUrl = await QRCode.toDataURL(this.qrCodeUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (error) {
        console.error('Error generando código QR:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo generar el código QR'
        });
      }
    }
  }

  onVerifyMFA() {
    if (!this.mfaCode || this.mfaCode.length !== 6) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Código inválido',
        detail: 'Por favor, ingresa un código de 6 dígitos'
      });
      return;
    }

    this.loading = true;

    const credentials: LoginRequest & { mfa_code?: string } = {
      email: this.email,
      password: this.password,
      mfa_code: this.mfaCode
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.loading = false;

        if (response.access_token && response.usuario) {
          this.messageService.add({
            severity: 'success',
            summary: 'Verificación exitosa',
            detail: 'Autenticación completada correctamente'
          });
          this.mfaVerified.emit(response);
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Código inválido',
            detail: 'El código ingresado no es válido'
          });
        }
      },
      error: (error) => {
        this.loading = false;
        let errorMessage = 'Error al verificar el código';

        if (
          error.error &&
          error.error.body &&
          error.error.body.data &&
          error.error.body.data.length > 0
        ) {
          errorMessage = error.error.body.data[0].error || errorMessage;
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Error de verificación',
          detail: errorMessage
        });
      }
    });
  }

  onCancel() {
    this.cancelled.emit();
  }
}
