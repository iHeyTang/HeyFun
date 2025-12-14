import { ToolResult } from '@/agents/core/tools/tool-definition';
import { CanvasToolboxContext } from '../context';
import { buildNodeActionData, generateEdgeId, generateNodeId, getCanvasState, updateCanvasState } from '../utils';

const executor = async (args: any, context: CanvasToolboxContext): Promise<ToolResult> => {
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
              ...(nodeSpec.data?.description !== undefined && {
                description: nodeSpec.data.description,
              }),
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
};

export const editFlowCanvasTool = {
  toolName: 'edit_flow_canvas',
  executor,
};
