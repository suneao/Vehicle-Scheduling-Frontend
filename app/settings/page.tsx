import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">设置功能开发中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
