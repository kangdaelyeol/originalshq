export type DocType =
  'privacy' | 'terms' | 'location' | 'consent' | 'consent-third'
export type AppName = 'parke'
export type AppDocs = Record<DocType, React.ReactNode>
