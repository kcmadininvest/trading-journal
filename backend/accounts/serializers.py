from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import datetime, timedelta
from .models import User, UserPreferences


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour l'inscription des utilisateurs
    """
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = (
            'email', 'username', 'first_name', 'last_name',
            'password', 'password_confirm'
        )
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserLoginSerializer(serializers.Serializer):
    """
    Sérialiseur pour la connexion des utilisateurs
    """
    email = serializers.EmailField()
    password = serializers.CharField(
        style={'input_type': 'password'},
        write_only=True
    )
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(
                request=self.context.get('request'),
                username=email,
                password=password
            )
            
            if not user:
                raise serializers.ValidationError(
                    'Email ou mot de passe incorrect.',
                    code='authorization'
                )
            
            if not user.is_active:
                raise serializers.ValidationError(
                    'Ce compte utilisateur est désactivé.',
                    code='authorization'
                )
            
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError(
                'Email et mot de passe requis.',
                code='authorization'
            )


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le profil utilisateur
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    is_admin = serializers.BooleanField(read_only=True)
    is_regular_user = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name',
            'full_name', 'role', 'is_verified', 'is_active',
            'is_admin', 'is_regular_user', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'role', 'is_verified', 'created_at', 'updated_at')


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la mise à jour du profil utilisateur
    """
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'username')
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class UserFullUpdateSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la mise à jour complète du profil utilisateur
    Permet aux admins de modifier le rôle et le statut
    """
    email = serializers.EmailField(required=False)
    
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'username', 'email', 'role', 'is_verified', 'is_active')
    
    def update(self, instance, validated_data):
        # Vérifier si l'utilisateur actuel est admin
        current_user = self.context['request'].user
        if not current_user.is_admin:
            # Si ce n'est pas un admin, ne permettre que la modification des champs de base
            allowed_fields = ['first_name', 'last_name', 'username', 'email']
            filtered_data = {k: v for k, v in validated_data.items() if k in allowed_fields}
            validated_data = filtered_data
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    """
    Sérialiseur pour le changement de mot de passe
    """
    old_password = serializers.CharField(
        style={'input_type': 'password'},
        write_only=True
    )
    new_password = serializers.CharField(
        validators=[validate_password],
        style={'input_type': 'password'},
        write_only=True
    )
    new_password_confirm = serializers.CharField(
        style={'input_type': 'password'},
        write_only=True
    )
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Ancien mot de passe incorrect.")
        return value
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError("Les nouveaux mots de passe ne correspondent pas.")
        return attrs
    
    def save(self, **kwargs):
        user = self.context['request'].user
        if hasattr(self, 'validated_data') and self.validated_data and isinstance(self.validated_data, dict):
            new_password = self.validated_data.get('new_password')
            if new_password:
                user.set_password(new_password)
                user.save()
        return user


class AdminUserListSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la liste des utilisateurs (admin seulement)
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    trades_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name',
            'full_name', 'role', 'is_verified', 'is_active',
            'trades_count', 'created_at', 'last_login'
        )
    
    def get_trades_count(self, obj):
        # Cette méthode sera implémentée quand le modèle Trade sera créé
        return 0


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour la mise à jour des utilisateurs par l'admin
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    trades_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name',
            'full_name', 'role', 'is_verified', 'is_active',
            'trades_count', 'created_at', 'last_login'
        )
        read_only_fields = ('id', 'email', 'created_at', 'last_login')
    
    def get_trades_count(self, obj):
        # Cette méthode sera implémentée quand le modèle Trade sera créé
        return 0
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Sérialiseur personnalisé pour la connexion avec gestion de l'expiration automatique
    """
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Ajouter des informations personnalisées au token
        token['user_id'] = user.id
        token['username'] = user.username
        token['is_admin'] = user.is_admin
        token['session_start'] = datetime.now().isoformat()
        
        # Calculer l'expiration de la session (2 heures)
        session_expiry = datetime.now() + timedelta(hours=2)
        token['session_expiry'] = session_expiry.isoformat()
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Ajouter des informations de session à la réponse
        refresh = self.get_token(self.user)
        
        # Calculer les temps d'expiration
        now = datetime.now()
        access_expiry = now + timedelta(minutes=15)  # Access token expire dans 15 minutes
        refresh_expiry = now + timedelta(hours=2)    # Refresh token expire dans 2 heures
        
        # Créer un nouveau dictionnaire avec les données
        result = {}
        if isinstance(data, dict):
            result.update(data)
        
        if self.user:
            result['user'] = {
                'id': self.user.id,
                'email': self.user.email,
                'username': self.user.username,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'full_name': self.user.get_full_name(),
                'role': self.user.role,
                'is_verified': self.user.is_verified,
                'is_active': self.user.is_active,
                'is_admin': self.user.is_admin,
                'is_regular_user': self.user.is_regular_user,
                'created_at': self.user.created_at.isoformat(),
                'updated_at': self.user.updated_at.isoformat(),
            }
        result['session_info'] = {
            'access_token_expires_at': access_expiry.isoformat(),
            'refresh_token_expires_at': refresh_expiry.isoformat(),
            'session_expires_at': refresh_expiry.isoformat(),
            'auto_logout_warning_at': (refresh_expiry - timedelta(minutes=5)).isoformat(),  # Avertissement 5 min avant
        }
        
        return result


class SessionInfoSerializer(serializers.Serializer):
    """
    Sérialiseur pour les informations de session
    """
    access_token_expires_at = serializers.DateTimeField()
    refresh_token_expires_at = serializers.DateTimeField()
    session_expires_at = serializers.DateTimeField()
    auto_logout_warning_at = serializers.DateTimeField()
    time_remaining = serializers.IntegerField(help_text="Temps restant en secondes")
    warning_time_remaining = serializers.IntegerField(help_text="Temps avant avertissement en secondes")


class UserPreferencesSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les préférences utilisateur
    """
    class Meta:
        model = UserPreferences
        fields = (
            'language', 'timezone', 'date_format', 'number_format',
            'theme', 'font_size', 'created_at', 'updated_at'
        )
        read_only_fields = ('created_at', 'updated_at')


class ActiveSessionSerializer(serializers.Serializer):
    """
    Sérialiseur pour les sessions actives
    """
    jti = serializers.CharField()
    created_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField()
    is_current = serializers.BooleanField()
    device_info = serializers.CharField(required=False, allow_null=True)


class LoginHistorySerializer(serializers.Serializer):
    """
    Sérialiseur pour l'historique des connexions
    """
    date = serializers.DateTimeField()
    ip_address = serializers.CharField(required=False, allow_null=True)
    user_agent = serializers.CharField(required=False, allow_null=True)
    success = serializers.BooleanField()
