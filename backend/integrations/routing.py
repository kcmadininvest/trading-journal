from django.urls import path

from integrations.consumers import MarketQuotesConsumer

websocket_urlpatterns = [
    path('ws/market-quotes/', MarketQuotesConsumer.as_asgi()),
]
