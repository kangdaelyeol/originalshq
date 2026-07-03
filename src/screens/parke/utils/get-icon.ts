export const getIcon = (index: number): string => {
  switch (index) {
    case 0:
      return "(='X'=)"
    case 1:
      return '(^-^*)'
    case 2:
      return '(;-;)'
    case 3:
      return '(o^^)o'
    default:
      return 'error'
  }
}
