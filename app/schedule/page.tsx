import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function SchedulePage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>调度管理</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">调度功能开发中...</p>
        </CardContent>
      </Card>
    </div>
  )
}
