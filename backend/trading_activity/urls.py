from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'trading_activity'

router = DefaultRouter()
router.register(r'expense-categories', views.TradingActivityExpenseCategoryViewSet, basename='trading-activity-expense-category')
router.register(r'expenses', views.TradingActivityExpenseViewSet, basename='trading-activity-expense')
router.register(r'credits', views.TradingActivityCreditViewSet, basename='trading-activity-credit')

urlpatterns = [
    path('summary/', views.TradingActivitySummaryView.as_view(), name='trading-activity-summary'),
    path('currencies/', views.CurrencySuggestionsView.as_view(), name='trading-activity-currencies'),
    path('withdrawal-suggestions/', views.WithdrawalSuggestionsView.as_view(), name='trading-activity-withdrawal-suggestions'),
    path('', include(router.urls)),
]
