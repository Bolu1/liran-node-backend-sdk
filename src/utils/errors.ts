export class LiranError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiranError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends LiranError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ModelError extends LiranError {
  constructor(message: string) {
    super(message);
    this.name = 'ModelError';
  }
}

export class SessionError extends LiranError {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export class ToolError extends LiranError {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

export class AuthorizationError extends LiranError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class InitializationError extends LiranError {
  constructor(message: string) {
    super(message);
    this.name = 'InitializationError';
  }
}
