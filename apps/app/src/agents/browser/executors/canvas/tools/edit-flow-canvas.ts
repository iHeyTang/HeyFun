/**
 * 编辑工作流画布工具
 * 统一的工作流编辑工具，支持创建、修改、删除节点和连接
 * 每次调用应尽可能完成所有需要的修改，而不是分次调用
 */

import { ToolResult, ToolExecutionContext } from '../../../types';
import { createTool } from '../base';
import { getCanvasState, updateCanvasState, generateNodeId, generateEdgeId, buildNodeActionData } from '../helpers';

export const editFlowCanvasTool = createTool(
  {
    type: 'function',
    function: {
      name: 'edit_flow_canvas',
      description:
        '编辑工作流画布。支持创建新工作流、修改现有节点和连接、删除节点和连接。每次调用应尽可能完成所有需要的修改，而不是分次调用。例如：创建完整工作流时传入完整的 nodes 和 edges；修改时传入所有需要修改的节点和边。',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['replace', 'merge'],
            description: '更新模式：replace 表示完全替换画布（用于创建新工作流），merge 表示合并更新（用于修改现有工作流）。默认为 merge。',
            default: 'merge',
          },
          nodes: {
            type: 'array',
            description:
              '节点列表。在 replace 模式下，这会完全替换所有节点；在 merge 模式下，这会更新或添加节点（根据节点 ID 匹配）。如果节点没有 ID，会自动生成。',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '节点 ID。如果不存在，会自动生成。在 merge 模式下，如果 ID 已存在则更新该节点。' },
                type: {
                  type: 'string',
                  enum: ['text', 'image', 'video', 'audio', 'music', 'group'],
                  description: '节点类型',
                },
                position: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                  },
                  description: '节点位置',
                },
                parentId: { type: 'string', description: '父节点 ID（用于 group 节点）' },
                data: {
                  type: 'object',
                  description: '节点数据',
                  properties: {
                    label: { type: 'string', description: '节点标签/标题' },
                    description: { type: 'string', description: '节点描述' },
                    auto: { type: 'boolean', description: '是否自动执行' },
                    actionData: {
                      type: 'object',
                      description:
                        '节点动作数据。根据节点类型不同：text 节点使用 text 字段；image/video/music 节点使用 prompt、selectedModel 等；audio 节点使用 prompt、voiceId、selectedModel 等',
                    },
                  },
                },
              },
            },
          },
          edges: {
            type: 'array',
            description:
              '连接列表。在 replace 模式下，这会完全替换所有连接；在 merge 模式下，这会更新或添加连接（根据连接 ID 或 source/target 匹配）。如果连接没有 ID，会自动生成。',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '连接 ID。如果不存在，会自动生成。' },
                source: { type: 'string', description: '源节点 ID' },
                target: { type: 'string', description: '目标节点 ID' },
                sourceHandle: { type: 'string', description: '源节点连接点，默认 output', default: 'output' },
                targetHandle: { type: 'string', description: '目标节点连接点，默认 input', default: 'input' },
                type: { type: 'string', description: '连接类型，默认 default', default: 'default' },
              },
              required: ['source', 'target'],
            },
          },
          deleteNodes: {
            type: 'array',
            description: '要删除的节点 ID 列表（仅在 merge 模式下有效）',
            items: { type: 'string' },
          },
          deleteEdges: {
            type: 'array',
            description: '要删除的连接 ID 列表（仅在 merge 模式下有效）',
            items: { type: 'string' },
          },
        },
      },
    },
  },
  async (args: any, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const { mode = 'merge', nodes = [], edges = [], deleteNodes = [], deleteEdges = [] } = args;
      const currentState = getCanvasState(context);

      let newState: any;

      if (mode === 'replace') {
        // 完全替换模式：创建新工作流
        newState = {
          nodes: [],
          edges: [],
        };

        // 处理节点
        for (const nodeSpec of nodes) {
          const nodeId = nodeSpec.id || generateNodeId();
          const newNode = {
            id: nodeId,
            type: nodeSpec.type,
            position: nodeSpec.position || { x: Math.random() * 400, y: Math.random() * 400 },
            ...(nodeSpec.parentId && { parentId: nodeSpec.parentId }),
            data: {
              label: nodeSpec.data?.label || '',
              description: nodeSpec.data?.description || '',
              auto: nodeSpec.data?.auto !== false,
              ...(nodeSpec.data?.actionData && { actionData: nodeSpec.data.actionData }),
            },
          };
          newState.nodes.push(newNode);
        }

        // 处理连接
        for (const edgeSpec of edges) {
          const edgeId = edgeSpec.id || generateEdgeId();
          const newEdge = {
            id: edgeId,
            source: edgeSpec.source,
            target: edgeSpec.target,
            sourceHandle: edgeSpec.sourceHandle || 'output',
            targetHandle: edgeSpec.targetHandle || 'input',
            type: edgeSpec.type || 'default',
          };
          newState.edges.push(newEdge);
        }
      } else {
        // 合并模式：更新现有工作流
        newState = {
          nodes: [...(currentState.nodes || [])],
          edges: [...(currentState.edges || [])],
        };

        // 删除节点
        if (deleteNodes.length > 0) {
          newState.nodes = newState.nodes.filter((node: any) => !deleteNodes.includes(node.id));
          // 同时删除相关的连接
          newState.edges = newState.edges.filter((edge: any) => !deleteNodes.includes(edge.source) && !deleteNodes.includes(edge.target));
        }

        // 删除连接
        if (deleteEdges.length > 0) {
          newState.edges = newState.edges.filter((edge: any) => !deleteEdges.includes(edge.id));
        }

        // 更新或添加节点
        for (const nodeSpec of nodes) {
          const nodeId = nodeSpec.id || generateNodeId();
          const existingIndex = newState.nodes.findIndex((node: any) => node.id === nodeId);

          const nodeData: any = {
            label: nodeSpec.data?.label || '',
            description: nodeSpec.data?.description || '',
            auto: nodeSpec.data?.auto !== false,
          };

          // 如果提供了 actionData，使用它；否则尝试从 data 构建
          if (nodeSpec.data?.actionData) {
            nodeData.actionData = nodeSpec.data.actionData;
          } else if (nodeSpec.type && nodeSpec.data) {
            // 使用 buildNodeActionData 构建 actionData
            const builtData = buildNodeActionData(nodeSpec.type, nodeSpec.data);
            if (builtData.actionData) {
              nodeData.actionData = builtData.actionData;
            }
          }

          const newNode = {
            id: nodeId,
            type: nodeSpec.type,
            position: nodeSpec.position || { x: Math.random() * 400, y: Math.random() * 400 },
            ...(nodeSpec.parentId && { parentId: nodeSpec.parentId }),
            data: nodeData,
          };

          if (existingIndex >= 0) {
            // 更新现有节点（保留原有数据，只更新提供的字段）
            const existingNode = newState.nodes[existingIndex];
            newState.nodes[existingIndex] = {
              ...existingNode,
              ...(nodeSpec.type && { type: nodeSpec.type }),
              ...(nodeSpec.position && { position: nodeSpec.position }),
              ...(nodeSpec.parentId !== undefined && { parentId: nodeSpec.parentId }),
              data: {
                ...existingNode.data,
                ...(nodeSpec.data?.label !== undefined && { label: nodeSpec.data.label }),
                ...(nodeSpec.data?.description !== undefined && { description: nodeSpec.data.description }),
                ...(nodeSpec.data?.auto !== undefined && { auto: nodeSpec.data.auto }),
                ...(nodeData.actionData && { actionData: nodeData.actionData }),
              },
            };
          } else {
            // 添加新节点
            newState.nodes.push(newNode);
          }
        }

        // 更新或添加连接
        for (const edgeSpec of edges) {
          const edgeId = edgeSpec.id || generateEdgeId();
          const existingIndex = newState.edges.findIndex(
            (edge: any) =>
              edge.id === edgeId ||
              (edge.source === edgeSpec.source &&
                edge.target === edgeSpec.target &&
                (edge.sourceHandle || 'output') === (edgeSpec.sourceHandle || 'output') &&
                (edge.targetHandle || 'input') === (edgeSpec.targetHandle || 'input')),
          );

          const newEdge = {
            id: edgeId,
            source: edgeSpec.source,
            target: edgeSpec.target,
            sourceHandle: edgeSpec.sourceHandle || 'output',
            targetHandle: edgeSpec.targetHandle || 'input',
            type: edgeSpec.type || 'default',
          };

          if (existingIndex >= 0) {
            // 更新现有连接
            newState.edges[existingIndex] = newEdge;
          } else {
            // 添加新连接
            newState.edges.push(newEdge);
          }
        }
      }

      updateCanvasState(context, newState);

      const nodeCount = newState.nodes.length;
      const edgeCount = newState.edges.length;
      const addedNodes = nodes.length;
      const addedEdges = edges.length;
      const deletedNodesCount = deleteNodes.length;
      const deletedEdgesCount = deleteEdges.length;

      let message = `✅ 工作流已更新\n`;
      message += `📦 节点总数: ${nodeCount}\n`;
      message += `🔗 连接总数: ${edgeCount}\n`;
      if (mode === 'replace') {
        message += `\n🆕 创建了 ${addedNodes} 个节点，${addedEdges} 个连接`;
      } else {
        if (addedNodes > 0 || addedEdges > 0) {
          message += `\n➕ 添加/更新: ${addedNodes} 个节点，${addedEdges} 个连接`;
        }
        if (deletedNodesCount > 0 || deletedEdgesCount > 0) {
          message += `\n🗑️ 删除: ${deletedNodesCount} 个节点，${deletedEdgesCount} 个连接`;
        }
      }

      return {
        success: true,
        message,
        data: {
          nodeCount,
          edgeCount,
          addedNodes,
          addedEdges,
          deletedNodes: deletedNodesCount,
          deletedEdges: deletedEdgesCount,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
);
