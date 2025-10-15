from rolepermissions.roles import AbstractUserRole


class User(AbstractUserRole):
    """
    Rôle utilisateur standard
    """
    available_permissions = {
        'view_own_trades': True,
        'add_own_trades': True,
        'change_own_trades': True,
        'delete_own_trades': True,
        'view_own_profile': True,
        'change_own_profile': True,
        'view_own_statistics': True,
    }


class Admin(AbstractUserRole):
    """
    Rôle administrateur avec tous les privilèges
    """
    available_permissions = {
        # Permissions utilisateur
        'view_own_trades': True,
        'add_own_trades': True,
        'change_own_trades': True,
        'delete_own_trades': True,
        'view_own_profile': True,
        'change_own_profile': True,
        'view_own_statistics': True,
        
        # Permissions administrateur
        'view_all_users': True,
        'add_users': True,
        'change_users': True,
        'delete_users': True,
        'view_all_trades': True,
        'change_all_trades': True,
        'delete_all_trades': True,
        'view_system_statistics': True,
        'manage_system_settings': True,
        'view_admin_panel': True,
        'export_data': True,
        'manage_backups': True,
    }
