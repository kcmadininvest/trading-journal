"""
Glossaire métier (journal de trading) — aligné avec le code de ``account_balance`` et les vues.

Les noms exposés en API doivent rester stables ; les synonymes ci-dessous servent à la lecture du code.

- **trading_equity** : capital initial + somme des ``net_pnl`` des trades (sans dépôts ni retraits).
- **current_balance** : solde de trésorerie = trading_equity + (dépôts - retraits).
- **net_transactions** : somme algébrique des flux externes (dépôts moins retraits).
- **account_balance** (métriques quotidiennes) : solde basé sur le trading uniquement, sans flux externes.

Pour la performance agrégée multi-comptes en devises différentes, l'UI ne doit pas
afficher un symbole monétaire unique trompeur.
"""
