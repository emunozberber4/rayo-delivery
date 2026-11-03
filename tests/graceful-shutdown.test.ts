/**
 * ============================================================================
 * RAYO DELIVERY — PRUEBAS DE GRACEFUL SHUTDOWN Y CIERRE ORDENADO (FASE 10)
 * ============================================================================
 * Valida que el servidor Express implementa el cierre ordenado para Cloud Run:
 * 1. Captura y procesamiento de SIGTERM.
 * 2. Captura y procesamiento de SIGINT.
 * 3. Protección contra señales reentrantes (idempotencia del apagado).
 * 4. Cierre ordenado de conexiones HTTP (server.close) y cierre de sockets ociosos.
 * 5. Mecanismo de timeout de seguridad (exit 1 si se excede el tiempo límite).
 * 6. Salida limpia con código 0 al finalizar normalmente.
 * ============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { setupGracefulShutdown } from '../server';

describe('FASE 10: Graceful Shutdown y Endurecimiento del Servidor', () => {

  it('TC-GS-01: Procesa señal SIGTERM y llama a exit(0) al cerrar el servidor HTTP limpiamente', async () => {
    let exitCode: number | null = null;
    let serverCloseCalled = false;
    let idleConnectionsClosed = false;

    // Crear mock server de http.Server
    const mockServer = {
      close: (cb: (err?: Error) => void) => {
        serverCloseCalled = true;
        setTimeout(() => cb(), 10);
        return mockServer;
      },
      closeIdleConnections: () => {
        idleConnectionsClosed = true;
      }
    } as unknown as http.Server;

    const manager = setupGracefulShutdown(mockServer, {
      timeoutMs: 1000,
      onExit: (code) => {
        exitCode = code;
      }
    });

    try {
      const handled = manager.handleShutdown('SIGTERM');
      assert.equal(handled, true, 'Debe procesar la primera señal SIGTERM');
      assert.equal(manager.isShuttingDown(), true, 'isShuttingDown debe ser true');

      // Esperar resolución del callback de cierre
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(serverCloseCalled, true, 'server.close() debe haber sido invocado');
      assert.equal(idleConnectionsClosed, true, 'server.closeIdleConnections() debe haber sido invocado');
      assert.equal(exitCode, 0, 'Código de salida debe ser 0 para un cierre limpio');
    } finally {
      manager.cleanupListeners();
    }
  });

  it('TC-GS-02: Previene llamadas reentrantes ante múltiples señales consecutivas', async () => {
    let exitCalls = 0;
    const mockServer = {
      close: (cb: (err?: Error) => void) => {
        setTimeout(() => cb(), 20);
        return mockServer;
      },
      closeIdleConnections: () => {}
    } as unknown as http.Server;

    const manager = setupGracefulShutdown(mockServer, {
      timeoutMs: 1000,
      onExit: () => {
        exitCalls++;
      }
    });

    try {
      const firstHandled = manager.handleShutdown('SIGTERM');
      const secondHandled = manager.handleShutdown('SIGTERM');
      const thirdHandled = manager.handleShutdown('SIGINT');

      assert.equal(firstHandled, true, 'La primera señal debe ser procesada');
      assert.equal(secondHandled, false, 'La segunda señal debe ser ignorada');
      assert.equal(thirdHandled, false, 'La tercera señal debe ser ignorada');

      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(exitCalls, 1, 'exitFn sólo debe llamarse una vez');
    } finally {
      manager.cleanupListeners();
    }
  });

  it('TC-GS-03: Fuerza terminación con código 1 si expira el tiempo límite (timeout)', async () => {
    let exitCode: number | null = null;

    // Simular un servidor colgado donde server.close nunca invoca su callback
    const hangingServer = {
      close: () => {
        // Callback deliberadamente no ejecutado para probar timeout
        return hangingServer;
      },
      closeIdleConnections: () => {}
    } as unknown as http.Server;

    const manager = setupGracefulShutdown(hangingServer, {
      timeoutMs: 30, // Timeout ultracorto para prueba rápida
      onExit: (code) => {
        exitCode = code;
      }
    });

    try {
      manager.handleShutdown('SIGTERM');

      // Esperar a que transcurra el timeout (30ms)
      await new Promise((resolve) => setTimeout(resolve, 80));

      assert.equal(exitCode, 1, 'Debe salir con código 1 al expirar el tiempo de gracia');
    } finally {
      manager.cleanupListeners();
    }
  });

  it('TC-GS-04: Sale con código 1 si server.close reporta un error', async () => {
    let exitCode: number | null = null;

    const failingServer = {
      close: (cb: (err?: Error) => void) => {
        cb(new Error('Simulated socket close failure'));
        return failingServer;
      },
      closeIdleConnections: () => {}
    } as unknown as http.Server;

    const manager = setupGracefulShutdown(failingServer, {
      timeoutMs: 1000,
      onExit: (code) => {
        exitCode = code;
      }
    });

    try {
      manager.handleShutdown('SIGINT');
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(exitCode, 1, 'Debe salir con código 1 si el cierre del servidor falla');
    } finally {
      manager.cleanupListeners();
    }
  });

  it('TC-GS-05: El servidor real en Node.js escucha y responde en el puerto configurado', async () => {
    // Verificar que un servidor http real puede inicializarse y cerrarse con la función
    const testPort = 3199;
    const realServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    });

    await new Promise<void>((resolve) => realServer.listen(testPort, '127.0.0.1', () => resolve()));

    let closedProperly = false;
    const manager = setupGracefulShutdown(realServer, {
      timeoutMs: 2000,
      onExit: (code) => {
        if (code === 0) closedProperly = true;
      }
    });

    try {
      // Hacer request de prueba
      const res = await fetch(`http://127.0.0.1:${testPort}`);
      assert.equal(res.status, 200);

      // Disparar shutdown
      manager.handleShutdown('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 50));

      assert.equal(closedProperly, true, 'El servidor real debe cerrarse con exit(0)');
    } finally {
      manager.cleanupListeners();
      try { realServer.close(); } catch {}
    }
  });

});
