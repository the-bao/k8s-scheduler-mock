import { useState } from 'react'
import { useSimulationStore } from '../../store/simulation-store'

const messageDescriptions: Record<string, string> = {
  // Submit phase
  CREATE_POD: '用户通过 kubectl 提交 Pod 创建请求',
  WRITE_POD: 'API Server 将 Pod 数据写入 etcd 持久化存储',
  WRITE_POD_RESPONSE: 'etcd 确认数据写入成功，返回修订版本号',
  CREATE_POD_RESPONSE: 'API Server 返回 Pod 创建结果给用户',
  // Controller phase
  WATCH_EVENT_POD_ADDED: 'etcd 通过 Watch 机制通知 controller-manager 有新 Pod 创建',
  // Operator phase
  RECONCILE_TRIGGERED: '控制器被触发，开始调谐（Reconcile）循环',
  CALCULATE_DIFF: '计算期望状态与实际状态的差异',
  CREATE_RESOURCE: '控制器创建新的子资源',
  UPDATE_STATUS: '控制器更新资源的 Status 字段',
  CRON_TRIGGERED: 'Cron 定时器触发，创建新的 Job',
  // Scheduling phase
  WATCH_EVENT_UNSCHEDULED_POD: 'etcd 通知调度器有未调度的 Pod 需要分配节点',
  FILTER_NODES: '调度器执行预选（Predicates），过滤不满足条件的节点',
  SCORE_NODES: '调度器执行优选（Priorities），对可行节点打分排名',
  BIND_POD: '调度器将 Pod 绑定到得分最高的节点',
  UPDATE_POD_BIND: 'API Server 将节点绑定信息写入 etcd',
  // Kubelet phase
  WATCH_EVENT_POD_BOUND: 'etcd 通知 Kubelet 有 Pod 已绑定到本节点',
  CREATE_SANDBOX: 'Kubelet 通过 CRI 创建 Pod 沙箱（Pause 容器）',
  CNI_SETUP: 'Kubelet 调用 CNI 插件为 Pod 配置网络并分配 IP',
  CSI_STAGE_VOLUME: 'Kubelet 调用 CSI 驱动将存储卷暂存到节点',
  CSI_PUBLISH_VOLUME: 'Kubelet 调用 CSI 驱动将存储卷挂载到 Pod 目录',
  PULL_IMAGE: 'Kubelet 通过 CRI 拉取容器镜像',
  START_CONTAINER: 'Kubelet 通过 CRI 启动业务容器',
  UPDATE_POD_STATUS: 'Kubelet 更新 Pod 状态为 Running',
  WRITE_POD_STATUS: 'API Server 将 Pod 运行状态写入 etcd',
  // Legacy operator plugin
  OPERATOR_CREATECONFIGMAP: 'Operator 插件创建 ConfigMap',
  OPERATOR_CREATERESOURCE: 'Operator 插件创建资源',
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="text-xs text-green-400 bg-gray-900 p-3 rounded overflow-auto max-h-[300px] whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export function DetailPanel() {
  const [tab, setTab] = useState<'request' | 'logs' | 'status'>('request')
  const { messages, currentIndex, resources } = useSimulationStore()

  const currentMsg = currentIndex >= 0 ? messages[currentIndex] : null

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      <div className="flex border-b border-gray-700">
        {(['request', 'logs', 'status'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {tab === 'request' && (
          currentMsg ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400">
                  <span className="text-yellow-400">{currentMsg.type}</span>
                  {' '}({currentMsg.phase})
                </div>
                {messageDescriptions[currentMsg.type] && (
                  <div className="text-xs text-gray-300 mt-1">
                    {messageDescriptions[currentMsg.type]}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">From → To</div>
                <div className="text-sm text-white">
                  {currentMsg.from} → {currentMsg.to}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Request</div>
                <JsonBlock data={currentMsg.request} />
              </div>
              {currentMsg.response && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Response</div>
                  <JsonBlock data={currentMsg.response} />
                </div>
              )}
              {currentMsg.error && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 text-red-400">Error</div>
                  <JsonBlock data={currentMsg.error} />
                </div>
              )}
              <div className="text-xs text-gray-500">
                Latency: {currentMsg.latency}ms
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No message selected</div>
          )
        )}

        {tab === 'logs' && (
          <div className="space-y-1 font-mono text-xs">
            {messages.slice(0, currentIndex + 1).map((msg, i) => (
              <div key={msg.id} className={`py-0.5 ${i === currentIndex ? 'bg-gray-800 -mx-1 px-1 rounded' : ''}`}>
                <span className="text-gray-500">{new Date(msg.timestamp).toISOString().slice(11, 23)}</span>{' '}
                <span className="text-cyan-400">[{msg.from}]</span>{' '}
                <span className={msg.error ? 'text-red-400' : 'text-gray-300'}>{msg.type}</span>
                {msg.error && <span className="text-red-400"> ERROR: {msg.error.message}</span>}
              </div>
            ))}
            {currentIndex < 0 && <div className="text-gray-500">No logs yet</div>}
          </div>
        )}

        {tab === 'status' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-2">Pods</div>
              {Object.keys(resources.pods).length === 0 ? (
                <div className="text-gray-600 text-xs">No pods</div>
              ) : (
                Object.entries(resources.pods).map(([name, pod]) => (
                  <div key={name} className="text-xs mb-1">
                    <span className="text-white">{name}</span>{' '}
                    <span className={pod.status === 'Running' ? 'text-green-400' : 'text-yellow-400'}>
                      {pod.status}
                    </span>
                    {pod.nodeName && <span className="text-gray-500"> on {pod.nodeName}</span>}
                  </div>
                ))
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Nodes</div>
              {Object.entries(resources.nodes).map(([name, node]) => (
                <div key={name} className="text-xs mb-2">
                  <div className="text-white">{name}</div>
                  <div className="text-gray-400 ml-2">
                    CPU: {node.cpu.used}/{node.cpu.allocatable} | MEM: {node.memory.used}/{node.memory.allocatable}MB
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Custom Resources</div>
              {Object.keys(resources.customResources).length === 0 ? (
                <div className="text-gray-600 text-xs">No custom resources</div>
              ) : (
                Object.entries(resources.customResources).flatMap(([gvk, resourcesByName]) =>
                  Object.entries(resourcesByName).map(([name, cr]) => (
                    <div key={`${gvk}-${name}`} className="text-xs mb-1">
                      <span className="text-white">{name}</span>{' '}
                      <span className="text-cyan-400">{cr.kind}</span>
                      {cr.status?.phase ? <span className="text-yellow-400 ml-1">{String(cr.status.phase)}</span> : null}
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
