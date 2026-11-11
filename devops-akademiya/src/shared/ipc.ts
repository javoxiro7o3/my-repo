/** IPC whitelist — preload faqat shu kanallarga ruxsat beradi. */
export const INVOKE_CHANNELS = [
  'settings:get', 'settings:set', 'key:set', 'key:test', 'key:clear',
  'ai:start', 'ai:cancel', 'ai:cached', 'cache:clear', 'usage:get',
  'progress:mark', 'progress:last', 'progress:reset', 'stats:get', 'event:add',
  'quiz:record', 'quiz:weak', 'srs:due', 'srs:review',
  'notes:list', 'notes:add', 'notes:update', 'notes:delete', 'bookmark:toggle',
  'chat:list', 'chat:add', 'chat:clear', 'search:query', 'project:toggle',
  'export:pdf', 'export:md', 'backup:export', 'backup:import',
  'app:info', 'app:openExternal', 'window:theme'
] as const
export type InvokeChannel = (typeof INVOKE_CHANNELS)[number]
export const EVENT_CHANNELS = ['ai:event', 'app:reward'] as const
export type EventChannel = (typeof EVENT_CHANNELS)[number]

/** Tashqi brauzerda ochishga ruxsat etilgan xostlar */
export const EXTERNAL_HOSTS = ['aistudio.google.com', 'ai.google.dev', 'github.com', 'kubernetes.io', 'docs.docker.com']
