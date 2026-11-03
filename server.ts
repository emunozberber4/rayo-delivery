import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Server } from 'http';
import { verifyAuthToken, createServerAuthorizedOrder } from './src/server/orderService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const appTarget = process.env.APP_TARGET; // 'clientes' | 'repartidores' | 'admin'

// Parse JSON bodies
app.use(express.json());

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Determine build directory to serve
let staticDir = path.resolve(__dirname, 'dist');
if (appTarget && fs.existsSync(path.resolve(__dirname, 'dist', appTarget))) {
  staticDir = path.resolve(__dirname, 'dist', appTarget);
}

// Health check endpoint for Google Cloud Run
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    appTarget: appTarget || 'unified', 
    port,
    timestamp: new Date().toISOString() 
  });
});

// Authoritative Order Pricing & Coupon Validation API (Fiduciary Security)
const AUTHORITATIVE_COUPONS: Record<string, { type: 'fixed' | 'percent'; value: number }> = {
  'BIRRIA2GO': { type: 'percent', value: 0.5 },
  'BIENVENIDO': { type: 'fixed', value: 5 },
  'RAYO50': { type: 'percent', value: 0.5 },
};

app.post('/api/orders/validate-pricing', (req, res) => {
  try {
    const { items, couponCode, clientDeclaredTotal } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Lista de productos inválida o vacía.' });
    }

    // Authoritative calculation of subtotal
    const calculatedSubtotal = items.reduce((sum: number, item: any) => {
      const unitPrice = Number(item.price) || 0;
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      return sum + (unitPrice * quantity);
    }, 0);

    // Authoritative coupon discount calculation
    let calculatedDiscount = 0;
    const cleanCoupon = (couponCode || '').toUpperCase().trim();
    if (cleanCoupon && AUTHORITATIVE_COUPONS[cleanCoupon]) {
      const coupon = AUTHORITATIVE_COUPONS[cleanCoupon];
      if (coupon.type === 'percent') {
        calculatedDiscount = calculatedSubtotal * coupon.value;
      } else {
        calculatedDiscount = Math.min(calculatedSubtotal, coupon.value);
      }
    }

    const calculatedDeliveryFee = 0; // Promoción activa: Q0
    const authoritativeTotal = Math.max(0, calculatedSubtotal - calculatedDiscount + calculatedDeliveryFee);

    // Tampering detection check
    const isTampered = clientDeclaredTotal !== undefined && Math.abs(clientDeclaredTotal - authoritativeTotal) > 0.01;

    return res.status(200).json({
      valid: !isTampered,
      subtotal: Math.round(calculatedSubtotal * 100) / 100,
      discount: Math.round(calculatedDiscount * 100) / 100,
      deliveryFee: calculatedDeliveryFee,
      authoritativeTotal: Math.round(authoritativeTotal * 100) / 100,
      appliedCoupon: calculatedDiscount > 0 ? cleanCoupon : null,
      tamperingDetected: isTampered,
      message: isTampered ? 'Discrepancia detectada entre el total del cliente y el cálculo fiduciario del servidor.' : 'Cálculo de precios validado correctamente.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al validar pedido en servidor', details: err?.message });
  }
});

// Authoritative Order Creation Endpoint (Fase 5 - Tarea 2)
app.post('/api/orders', async (req, res) => {
  try {
    // 1. Verify Authentication Token
    const authUser = await verifyAuthToken(req.headers.authorization);
    if (!authUser) {
      return res.status(401).json({
        error: 'No autorizado. Se requiere token de Firebase Authentication válido en la cabecera Authorization: Bearer <token>.'
      });
    }

    // 2. Authoritative creation and price recalculation
    const result = await createServerAuthorizedOrder(authUser.uid, authUser.email, req.body);
    return res.status(201).json({
      success: true,
      orderId: result.orderId,
      order: result.order,
      isDuplicate: result.isDuplicate || false
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'Error interno del servidor al procesar el pedido.',
      details: err.details
    });
  }
});

// Serve static assets with cache headers
app.use(express.static(staticDir, {
  maxAge: '1h',
  index: 'index.html',
}));

// Route guard: Prevent sending index.html for missing static assets to prevent MIME type syntax errors
app.use((req, res, next) => {
  if (req.path.startsWith('/assets/') || path.extname(req.path)) {
    return res.status(404).type('text/plain').send(`Static asset not found: ${req.path}`);
  }
  next();
});

// SPA Fallback: send index.html for client-side routing
app.get('*', (_req, res) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    const targetHtml = appTarget ? path.join(staticDir, `${appTarget}.html`) : null;
    if (targetHtml && fs.existsSync(targetHtml)) {
      res.sendFile(targetHtml);
    } else {
      res.status(404).send('Build not found. Please run npm run build or npm run build:[target].');
    }
  }
});

// Graceful Shutdown Configuration
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);

export interface GracefulShutdownOptions {
  timeoutMs?: number;
  onExit?: (code: number) => void;
}

export function setupGracefulShutdown(
  httpServer: Server,
  options: GracefulShutdownOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  const exitFn = options.onExit ?? ((code: number) => process.exit(code));
  let isShuttingDown = false;

  const handleShutdown = (signal: string): boolean => {
    if (isShuttingDown) {
      console.warn(`[Rayo Delivery Graceful Shutdown] Señal ${signal} ignorada: proceso de cierre ordenado ya en curso.`);
      return false;
    }
    isShuttingDown = true;
    console.log(`[Rayo Delivery Graceful Shutdown] Señal ${signal} recibida. Iniciando cierre ordenado del servidor...`);

    // Safety timeout: Force process termination if in-flight connections hang
    const timer = setTimeout(() => {
      console.error(`[Rayo Delivery Graceful Shutdown] Tiempo límite de espera agotado (${timeoutMs}ms). Forzando terminación.`);
      exitFn(1);
    }, timeoutMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    // Stop accepting new connections
    httpServer.close((err) => {
      clearTimeout(timer);
      if (err) {
        console.error('[Rayo Delivery Graceful Shutdown] Error durante el cierre del servidor HTTP:', err);
        exitFn(1);
        return;
      }
      console.log('[Rayo Delivery Graceful Shutdown] Servidor HTTP cerrado correctamente. Todas las conexiones finalizadas.');
      exitFn(0);
    });

    // Close idle connections immediately to allow active requests to finish cleanly
    if (typeof (httpServer as any).closeIdleConnections === 'function') {
      (httpServer as any).closeIdleConnections();
    }

    return true;
  };

  const sigtermListener = () => handleShutdown('SIGTERM');
  const sigintListener = () => handleShutdown('SIGINT');

  process.on('SIGTERM', sigtermListener);
  process.on('SIGINT', sigintListener);

  return {
    handleShutdown,
    isShuttingDown: () => isShuttingDown,
    cleanupListeners: () => {
      process.removeListener('SIGTERM', sigtermListener);
      process.removeListener('SIGINT', sigintListener);
    }
  };
}

export let server: Server | null = null;
export let shutdownManager: ReturnType<typeof setupGracefulShutdown> | null = null;

export function startServer(customPort?: number) {
  const listenPort = customPort ?? port;
  server = app.listen(listenPort, '0.0.0.0', () => {
    console.log(`[Rayo Delivery] Server running on port ${listenPort} serving target: ${appTarget || 'unified'}`);
    console.log(`[Rayo Delivery] Serving static directory: ${staticDir}`);
  });
  shutdownManager = setupGracefulShutdown(server);
  return { server, shutdownManager };
}

// Automatically start server in production, staging and dev (non-test environments)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
