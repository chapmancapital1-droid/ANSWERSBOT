from abc import ABC, abstractmethod
from ..schemas import RawAnswer

class PlatformAdapter(ABC):
    key: str
    @abstractmethod
    def query(self, query_text: str, location: str | None = None) -> RawAnswer: ...
