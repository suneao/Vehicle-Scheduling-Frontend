/**
 * 虚拟小车数据生成器
 * 用于前端测试：无真实 ROS 车辆接入时，模拟多辆小车在南方科技大学附近移动。
 * 车辆位置、速度、朝向随时间平滑变化，可在地图上显示并测试调度功能。
 */

import type { CarPosition } from "@/lib/api"

/** 虚拟小车开关：true 时真实数据为空会注入虚拟车辆 */
export const VIRTUAL_VEHICLES_ENABLED = true

/** 1 经度/纬度 ≈ 111 km（用于把角速度换算为 m/s） */
const DEG_TO_M = 111000

/** 虚拟车辆配置：绕中心点沿椭圆轨迹移动 */
interface VirtualVehicleConfig {
  car_id: number
  /** 轨迹中心（经度, 纬度） */
  cx: number
  cy: number
  /** 椭圆半径（经纬度度数） */
  radius: number
  /** 角速度（rad/s）：radius * speed ≈ 移动速度（度/s） */
  speed: number
  /** 相位偏移 */
  phase: number
}

const VIRTUAL_VEHICLES: VirtualVehicleConfig[] = [
  // 南方科技大学主校区附近（半径 0.003 度 ≈ 350m，角速度对应约 8 m/s）
  { car_id: 1, cx: 113.9992, cy: 22.6004, radius: 0.0032, speed: 0.0225, phase: 0.0 },
  { car_id: 2, cx: 114.0048, cy: 22.6042, radius: 0.0024, speed: 0.0300, phase: 1.4 },
  { car_id: 3, cx: 114.0015, cy: 22.5986, radius: 0.0041, speed: 0.0176, phase: 2.6 },
  { car_id: 4, cx: 114.0066, cy: 22.6018, radius: 0.0026, speed: 0.0277, phase: 4.0 },
]

/**
 * 生成当前时刻的虚拟车辆位置
 * 位置沿椭圆轨迹平滑移动，speed(m/s)/angle(度) 由轨迹导数计算
 */
export function getVirtualCarPositions(): Record<string, CarPosition> {
  const t = Date.now() / 1000
  const result: Record<string, CarPosition> = {}

  for (const v of VIRTUAL_VEHICLES) {
    const { car_id, cx, cy, radius, speed, phase } = v

    // 椭圆轨迹（纬向压缩，更接近实际道路形态）
    const x = cx + Math.cos(t * speed + phase) * radius
    const y = cy + Math.sin(t * speed + phase) * radius * 0.85

    // 轨迹导数 → 速度矢量 → 速度(m/s)与朝向(度)
    const vx = -Math.sin(t * speed + phase) * speed * radius
    const vy = Math.cos(t * speed + phase) * speed * radius * 0.85
    const speedMps = Math.hypot(vx, vy) * DEG_TO_M
    const angle = (Math.atan2(vy, vx) * 180) / Math.PI

    result[String(car_id)] = {
      car_id,
      x,
      y,
      speed: Number(speedMps.toFixed(2)),
      angle: Number(angle.toFixed(1)),
      update_time: new Date().toISOString(),
    }
  }

  return result
}
