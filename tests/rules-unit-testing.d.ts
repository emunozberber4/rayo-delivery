declare module '@firebase/rules-unit-testing' {
  export interface TestEnvironmentConfig {
    projectId: string;
    firestore?: {
      host?: string;
      port?: number;
      rules?: string;
    };
    auth?: {
      host?: string;
      port?: number;
    };
  }

  export interface RulesTestContext {
    firestore(): any;
    auth(): any;
  }

  export interface RulesTestEnvironment {
    authenticatedContext(userId: string, tokenOptions?: Record<string, any>): RulesTestContext;
    unauthenticatedContext(): RulesTestContext;
    withSecurityRulesDisabled<T>(callback: (context: RulesTestContext) => Promise<T>): Promise<T>;
    clearFirestore(): Promise<void>;
    cleanup(): Promise<void>;
  }

  export function initializeTestEnvironment(config: TestEnvironmentConfig): Promise<RulesTestEnvironment>;
  export function assertFails<T>(pr: Promise<T>): Promise<any>;
  export function assertSucceeds<T>(pr: Promise<T>): Promise<T>;
}
