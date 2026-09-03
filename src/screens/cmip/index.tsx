import { CsvImporter, BrandDashboard, ReportGenerator } from './components'

export default function CmipScreen() {
  return (
    <div>
      <CsvImporter />
      <BrandDashboard />
      <ReportGenerator />
    </div>
  )
}
