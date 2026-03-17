export type DocType = 'privacy' | 'terms' | 'consent' | 'consent-third' | null
export type AppName = 'parke' | null
export type AppDocs = Record<Exclude<DocType, null>, React.ReactNode>
