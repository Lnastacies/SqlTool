#!/usr/bin/env python3
"""
事件总线模块
"""

class EventBus:
    """事件总线，实现组件间的松耦合通信"""
    
    def __init__(self):
        self._subscribers = {}
    
    def subscribe(self, event_type, callback):
        """订阅事件"""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)
    
    def unsubscribe(self, event_type, callback):
        """取消订阅"""
        if event_type in self._subscribers:
            try:
                self._subscribers[event_type].remove(callback)
            except ValueError:
                pass
    
    def unsubscribe_all(self, event_type=None):
        """取消所有订阅"""
        if event_type:
            if event_type in self._subscribers:
                del self._subscribers[event_type]
        else:
            self._subscribers.clear()
    
    def publish(self, event_type, **kwargs):
        """发布事件"""
        if event_type in self._subscribers:
            for callback in self._subscribers[event_type]:
                try:
                    callback(**kwargs)
                except Exception as e:
                    pass
    
    def get_event_types(self):
        """获取所有已注册的事件类型"""
        return list(self._subscribers.keys())
    
    def get_subscriber_count(self, event_type=None):
        """获取订阅者数量"""
        if event_type:
            return len(self._subscribers.get(event_type, []))
        return sum(len(subscribers) for subscribers in self._subscribers.values())