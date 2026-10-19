"""Authz admin : gates rolepermissions + anti-élévation profil (pas IDOR classique)."""
from rest_framework.test import APITestCase

from accounts.models import User
from accounts.roles import Admin


class IdorAdminAuthzTests(APITestCase):
    def setUp(self) -> None:
        self.regular = User.objects.create_user(
            email='idor-admin-regular@example.com',
            username='idor_admin_regular',
            password='testpass123',
            first_name='Reg',
            last_name='User',
            role='user',
        )
        self.admin = User.objects.create_user(
            email='idor-admin-admin@example.com',
            username='idor_admin_admin',
            password='testpass123',
            first_name='Ad',
            last_name='Min',
            role='admin',
        )
        Admin.assign_role_to_user(self.admin)
        self.target = User.objects.create_user(
            email='idor-admin-target@example.com',
            username='idor_admin_target',
            password='testpass123',
            first_name='Tar',
            last_name='Get',
            role='user',
        )

    def test_regular_admin_users_list_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.get('/api/accounts/admin/users/')
        self.assertEqual(response.status_code, 403, response.data)

    def test_regular_admin_user_detail_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.get(f'/api/accounts/admin/users/{self.target.id}/')
        self.assertEqual(response.status_code, 403, response.data)

    def test_regular_admin_user_patch_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.patch(
            f'/api/accounts/admin/users/{self.target.id}/',
            {'role': 'admin'},
            format='json',
        )
        self.assertEqual(response.status_code, 403, response.data)
        self.target.refresh_from_db()
        self.assertEqual(self.target.role, 'user')

    def test_regular_admin_user_delete_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.delete(f'/api/accounts/admin/users/{self.target.id}/')
        self.assertEqual(response.status_code, 403, response.data)
        self.assertTrue(User.objects.filter(id=self.target.id).exists())

    def test_regular_deletion_preview_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.get(
            f'/api/accounts/admin/users/{self.target.id}/deletion-preview/'
        )
        self.assertEqual(response.status_code, 403, response.data)

    def test_regular_bulk_delete_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.post(
            '/api/accounts/admin/users/bulk-delete/',
            {'user_ids': [self.target.id]},
            format='json',
        )
        self.assertEqual(response.status_code, 403, response.data)
        self.assertTrue(User.objects.filter(id=self.target.id).exists())

    def test_regular_admin_stats_403(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.get('/api/accounts/admin/stats/')
        self.assertEqual(response.status_code, 403, response.data)

    def test_regular_cannot_self_elevate_role(self) -> None:
        self.client.force_authenticate(user=self.regular)
        response = self.client.put(
            '/api/accounts/profile/',
            {'role': 'admin', 'first_name': 'Reg'},
            format='json',
        )
        self.assertIn(response.status_code, (200, 400), response.data)
        self.regular.refresh_from_db()
        self.assertEqual(self.regular.role, 'user')

    def test_admin_can_retrieve_other_user(self) -> None:
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/accounts/admin/users/{self.target.id}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data.get('email'), self.target.email)

    def test_admin_can_delete_disposable_user(self) -> None:
        disposable = User.objects.create_user(
            email='idor-admin-disposable@example.com',
            username='idor_admin_disposable',
            password='testpass123',
            first_name='Dis',
            last_name='Posable',
            role='user',
        )
        disposable_id = disposable.id
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f'/api/accounts/admin/users/{disposable_id}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(User.objects.filter(id=disposable_id).exists())
