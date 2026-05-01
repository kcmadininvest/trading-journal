from django.urls import path

from . import views

app_name = 'billing'

urlpatterns = [
    path('checkout-session/', views.CreateCheckoutSessionView.as_view(), name='checkout_session'),
    path('portal-session/', views.CreatePortalSessionView.as_view(), name='portal_session'),
    path('subscription/', views.SubscriptionStatusView.as_view(), name='subscription_status'),
    path('webhook/', views.stripe_webhook, name='stripe_webhook'),
]

