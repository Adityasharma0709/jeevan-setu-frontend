export interface ProfileVm {
  name: string;
  email: string;
  usercode: string;
  id: string;
  roleLabel: string;
  roles: string[];
}

const EMPTY = '';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'System Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  OUTREACH: 'Outreach Worker',
};

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return EMPTY;
  const text = String(value).trim();
  return text || EMPTY;
};

const titleCase = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

const extractRoleNames = (raw: unknown): string[] => {
  if (!raw) return [];
  const rolesRaw = Array.isArray(raw) ? raw : [raw];
  const names = rolesRaw
    .map((role) => {
      if (!role) return EMPTY;
      if (typeof role === 'string') return role;
      return (
        (role as any)?.role?.name ??
        (role as any)?.name ??
        (role as any)?.roleName ??
        (role as any)?.role?.roleName ??
        EMPTY
      );
    })
    .map((name) => toText(name))
    .filter(Boolean);
  return Array.from(new Set(names));
};

const roleLabelFromRoles = (roles: string[], fallback?: string): string => {
  if (roles.length) {
    const normalized = roles.map((r) => r.toUpperCase());
    for (const key of Object.keys(ROLE_LABELS)) {
      if (normalized.includes(key)) return ROLE_LABELS[key];
    }
    return titleCase(roles[0]);
  }
  return fallback ? titleCase(fallback) : EMPTY;
};

const findFirstByKeysDeep = (source: unknown, keys: string[], maxDepth = 6): unknown => {
  if (!source || typeof source !== 'object') return undefined;

  const visited = new WeakSet<object>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];

  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (!value || typeof value !== 'object') continue;

    const obj = value as object;
    if (visited.has(obj)) continue;
    visited.add(obj);

    for (const key of keys) {
      const direct = (value as any)?.[key];
      if (direct !== null && direct !== undefined && String(direct).trim()) {
        return direct;
      }
    }

    if (depth >= maxDepth) continue;

    if (Array.isArray(value)) {
      for (const item of value) queue.push({ value: item, depth: depth + 1 });
      continue;
    }

    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
    }
  }

  return undefined;
};

export const emptyProfile = (roleLabel = ''): ProfileVm => ({
  name: EMPTY,
  email: EMPTY,
  usercode: EMPTY,
  id: EMPTY,
  roleLabel: roleLabel ? titleCase(roleLabel) : EMPTY,
  roles: [],
});

export const normalizeProfile = (raw: unknown, roleFallback = ''): ProfileVm => {
  const candidate = (raw as any)?.data ?? (raw as any)?.user ?? (raw as any)?.profile ?? raw;

  const name = toText(
    findFirstByKeysDeep(candidate, ['name', 'fullName', 'full_name']) ?? (candidate as any)?.name
  );
  const email = toText(
    findFirstByKeysDeep(candidate, ['email', 'emailId', 'email_id']) ?? (candidate as any)?.email
  );
  const usercode = toText(
    findFirstByKeysDeep(candidate, ['usercode', 'userCode', 'user_code']) ??
      (candidate as any)?.usercode ??
      (candidate as any)?.userCode
  );

  const idRaw =
    (candidate as any)?.id ??
    (candidate as any)?.userId ??
    (candidate as any)?.user_id ??
    EMPTY;
  const id = toText(idRaw);

  const rolesRaw = (candidate as any)?.roles ?? (raw as any)?.roles ?? [];
  const roles = extractRoleNames(rolesRaw);
  const roleLabel = roleLabelFromRoles(roles, roleFallback);

  return {
    name,
    email,
    usercode,
    id,
    roleLabel,
    roles,
  };
};
