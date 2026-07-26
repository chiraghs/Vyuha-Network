import os
import json
from typing import Any, Optional

try:
    import redis
    redis_available = True
except ImportError:
    redis_available = False

class BaseCacheService:
    def get(self, key: str) -> Optional[Any]:
        pass

    def set(self, key: str, value: Any, expire_seconds: int = 3600) -> None:
        pass

    def delete(self, key: str) -> None:
        pass


class RedisCacheService(BaseCacheService):
    def __init__(self, redis_url: str):
        self.client = redis.Redis.from_url(redis_url, decode_responses=True)

    def get(self, key: str) -> Optional[Any]:
        try:
            data = self.client.get(key)
            return json.loads(data) if data else None
        except Exception:
            return None

    def set(self, key: str, value: Any, expire_seconds: int = 3600) -> None:
        try:
            self.client.setex(key, expire_seconds, json.dumps(value))
        except Exception:
            pass

    def delete(self, key: str) -> None:
        try:
            self.client.delete(key)
        except Exception:
            pass


class InMemoryCacheService(BaseCacheService):
    def __init__(self):
        self._cache = {}

    def get(self, key: str) -> Optional[Any]:
        return self._cache.get(key)

    def set(self, key: str, value: Any, expire_seconds: int = 3600) -> None:
        self._cache[key] = value

    def delete(self, key: str) -> None:
        self._cache.pop(key, None)


class CacheServiceFactory:
    @staticmethod
    def get_cache_service() -> BaseCacheService:
        redis_url = os.getenv("REDIS_URL")
        if redis_url and redis_available:
            return RedisCacheService(redis_url)
        return InMemoryCacheService()
