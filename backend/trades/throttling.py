from rest_framework.throttling import UserRateThrottle


class TradeSyncThrottle(UserRateThrottle):
    scope = 'trade_sync'
