/**
 * 监控（车载 / 机器狗摄像头）数据模型
 * 后端未提供视频流，先用本地模拟多路监控；后续接入真实流时替换 getVehicleCameras。
 */

export interface MonitorCamera {
  id: string
  /** 短名称，用于切换按钮 */
  name: string
  /** 完整名称，用于画面水印 */
  label: string
  /** 视角方位，用于模拟不同画面的差异 */
  direction: "front" | "rear" | "left" | "right" | "top" | "all"
}

const VEHICLE_CAMERAS: MonitorCamera[] = [
  { id: "front", name: "前视", label: "前视摄像头", direction: "front" },
  { id: "rear", name: "后视", label: "后视摄像头", direction: "rear" },
  { id: "left", name: "左视", label: "左视摄像头", direction: "left" },
  { id: "right", name: "右视", label: "右视摄像头", direction: "right" },
  { id: "all", name: "全景", label: "全景摄像头", direction: "all" },
]

const ROBOT_CAMERAS: MonitorCamera[] = [
  { id: "front", name: "前视", label: "前视摄像头", direction: "front" },
  { id: "rear", name: "后视", label: "后视摄像头", direction: "rear" },
  { id: "top", name: "俯视", label: "俯视摄像头", direction: "top" },
  { id: "all", name: "全景", label: "全景摄像头", direction: "all" },
]

/** 获取某类车辆/机器狗的多路监控 */
export function getVehicleCameras(kind: "vehicle" | "robot"): MonitorCamera[] {
  return kind === "robot" ? ROBOT_CAMERAS : VEHICLE_CAMERAS
}
