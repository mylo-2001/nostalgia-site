"use strict";

class AdminAuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdminAuthorizationError";
    this.code = code;
  }
}

function assertPermission(permissionRows, requiredPermission) {
  const permissions = new Set((permissionRows || []).map((row) => row.permission_code));
  if (!permissions.has(requiredPermission)) {
    throw new AdminAuthorizationError("ADMIN_PERMISSION_DENIED",
      `Administrator lacks permission: ${requiredPermission}`);
  }
  return true;
}

module.exports = { AdminAuthorizationError, assertPermission };
