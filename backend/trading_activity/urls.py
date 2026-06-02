from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'trading_activity'

router = DefaultRouter()
router.register(r'expense-categories', views.TradingActivityExpenseCategoryViewSet, basename='trading-activity-expense-category')
router.register(r'expenses', views.TradingActivityExpenseViewSet, basename='trading-activity-expense')
router.register(r'credits', views.TradingActivityCreditViewSet, basename='trading-activity-credit')
router.register(r'tax-payments', views.TradingActivityTaxPaymentViewSet, basename='trading-activity-tax-payment')
router.register(
    r'tax-payment-types',
    views.TradingActivityTaxPaymentTypeViewSet,
    basename='trading-activity-tax-payment-type',
)

urlpatterns = [
    path(
        'tax-payment-builtin-labels/',
        views.TradingActivityTaxPaymentBuiltinLabelListView.as_view(),
        name='trading-activity-tax-payment-builtin-label-list',
    ),
    path(
        'tax-payment-builtin-labels/<str:code>/',
        views.TradingActivityTaxPaymentBuiltinLabelDetailView.as_view(),
        name='trading-activity-tax-payment-builtin-label-detail',
    ),
    path('summary/', views.TradingActivitySummaryView.as_view(), name='trading-activity-summary'),
    path('currencies/', views.CurrencySuggestionsView.as_view(), name='trading-activity-currencies'),
    path('withdrawal-suggestions/', views.WithdrawalSuggestionsView.as_view(), name='trading-activity-withdrawal-suggestions'),
    path('', include(router.urls)),
]
