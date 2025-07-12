import threading
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class SnowflakeConfig:
    """Snowflake配置类"""

    datacenter_id: int = 1
    worker_id: int = 1
    sequence: int = 0
    # 时间戳位数、数据中心位数、工作机器位数、序列号位数
    timestamp_bits: int = 41
    datacenter_bits: int = 5
    worker_bits: int = 5
    sequence_bits: int = 12
    # 起始时间戳 (2024-01-01 00:00:00 UTC)
    epoch: int = 1704067200000


class SnowflakeGenerator:
    """
    Snowflake ID生成器

    64位ID结构:
    - 符号位: 1位 (始终为0)
    - 时间戳: 41位 (毫秒级时间戳)
    - 数据中心ID: 5位 (0-31)
    - 工作机器ID: 5位 (0-31)
    - 序列号: 12位 (0-4095)
    """

    def __init__(self, config: Optional[SnowflakeConfig] = None):
        """
        初始化Snowflake生成器

        Args:
            config: Snowflake配置，如果为None则使用默认配置
        """
        self.config = config or SnowflakeConfig()

        # 验证配置参数
        self._validate_config()

        # 计算位移量
        self._timestamp_shift = (
            self.config.datacenter_bits
            + self.config.worker_bits
            + self.config.sequence_bits
        )
        self._datacenter_shift = self.config.worker_bits + self.config.sequence_bits
        self._worker_shift = self.config.sequence_bits

        # 计算最大值
        self._max_datacenter_id = (1 << self.config.datacenter_bits) - 1
        self._max_worker_id = (1 << self.config.worker_bits) - 1
        self._max_sequence = (1 << self.config.sequence_bits) - 1

        # 线程锁
        self._lock = threading.Lock()

        # 上次生成ID的时间戳
        self._last_timestamp = -1
        self._sequence = 0

    def _validate_config(self):
        """验证配置参数"""
        if not (0 <= self.config.datacenter_id <= 31):
            raise ValueError("datacenter_id必须在0-31之间")

        if not (0 <= self.config.worker_id <= 31):
            raise ValueError("worker_id必须在0-31之间")

        if not (0 <= self.config.sequence <= 4095):
            raise ValueError("sequence必须在0-4095之间")

        # 验证位数总和
        total_bits = (
            self.config.timestamp_bits
            + self.config.datacenter_bits
            + self.config.worker_bits
            + self.config.sequence_bits
        )
        if total_bits != 63:  # 64位减去符号位
            raise ValueError(f"位数总和必须为63，当前为{total_bits}")

    def _get_timestamp(self) -> int:
        """获取当前时间戳（毫秒）"""
        return int(time.time() * 1000)

    def _wait_for_next_millisecond(self, last_timestamp: int) -> int:
        """等待到下一个毫秒"""
        timestamp = self._get_timestamp()
        while timestamp <= last_timestamp:
            timestamp = self._get_timestamp()
        return timestamp

    def generate_id(self) -> int:
        """
        生成下一个Snowflake ID

        Returns:
            int: 64位唯一ID

        Raises:
            RuntimeError: 时钟回拨时抛出异常
        """
        with self._lock:
            timestamp = self._get_timestamp()

            # 检查时钟回拨
            if timestamp < self._last_timestamp:
                raise RuntimeError(
                    f"时钟回拨检测到！拒绝生成ID直到{self._last_timestamp}毫秒"
                )

            # 如果是同一毫秒内
            if timestamp == self._last_timestamp:
                self._sequence = (self._sequence + 1) & self._max_sequence
                # 如果序列号溢出，等待下一毫秒
                if self._sequence == 0:
                    timestamp = self._wait_for_next_millisecond(self._last_timestamp)
            else:
                # 新的毫秒，重置序列号
                self._sequence = 0

            self._last_timestamp = timestamp

            # 构建ID
            id_value = (
                ((timestamp - self.config.epoch) << self._timestamp_shift)
                | (self.config.datacenter_id << self._datacenter_shift)
                | (self.config.worker_id << self._worker_shift)
                | self._sequence
            )

            return id_value

    def parse_id(self, snowflake_id: int) -> dict:
        """
        解析Snowflake ID

        Args:
            snowflake_id: 要解析的Snowflake ID

        Returns:
            dict: 包含解析结果的字典
        """
        timestamp = (snowflake_id >> self._timestamp_shift) + self.config.epoch
        datacenter_id = (
            snowflake_id >> self._datacenter_shift
        ) & self._max_datacenter_id
        worker_id = (snowflake_id >> self._worker_shift) & self._max_worker_id
        sequence = snowflake_id & self._max_sequence

        return {
            "timestamp": timestamp,
            "datacenter_id": datacenter_id,
            "worker_id": worker_id,
            "sequence": sequence,
            "datetime": time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(timestamp / 1000)
            ),
        }


# 全局Snowflake实例
_snowflake_instance: Optional[SnowflakeGenerator] = None
_snowflake_lock = threading.Lock()


def get_snowflake_instance() -> SnowflakeGenerator:
    """
    获取全局Snowflake实例（单例模式）

    Returns:
        SnowflakeGenerator: 全局Snowflake实例
    """
    global _snowflake_instance

    if _snowflake_instance is None:
        with _snowflake_lock:
            if _snowflake_instance is None:
                _snowflake_instance = SnowflakeGenerator()

    return _snowflake_instance


def generate_snowflake_id() -> int:
    """
    生成Snowflake ID的便捷函数

    Returns:
        int: 64位唯一ID
    """
    return get_snowflake_instance().generate_id()


def generate_snowflake_id_str() -> str:
    """
    生成Snowflake ID的便捷函数
    """
    return str(generate_snowflake_id())


def parse_snowflake_id(snowflake_id: int) -> dict:
    """
    解析Snowflake ID的便捷函数

    Args:
        snowflake_id: 要解析的Snowflake ID

    Returns:
        dict: 包含解析结果的字典
    """
    return get_snowflake_instance().parse_id(snowflake_id)


# 使用示例
if __name__ == "__main__":
    # 创建自定义配置的Snowflake生成器
    config = SnowflakeConfig(
        datacenter_id=1, worker_id=2, epoch=1704067200000  # 2024-01-01 00:00:00 UTC
    )

    snowflake = SnowflakeGenerator(config)

    # 生成ID
    for i in range(5):
        snowflake_id = snowflake.generate_id()
        print(f"生成的ID: {snowflake_id}")

        # 解析ID
        parsed = snowflake.parse_id(snowflake_id)
        print(f"解析结果: {parsed}")
        print("-" * 50)

    # 使用便捷函数
    print("使用便捷函数:")
    for i in range(3):
        id_value = generate_snowflake_id()
        parsed = parse_snowflake_id(id_value)
        print(f"ID: {id_value}, 解析: {parsed}")
