import os
import json
from eth_account import Account

Account.enable_unaudited_hdwallet_features()

mnemonic = "wisdom matrix jazz solve weekend humble afford filter width latin dinner stem"

print("=" * 75)
print("  DERIVING ACCOUNTS FROM WORKSPACE 'RSSS' MNEMONIC:")
print(f"  \"{mnemonic}\"")
print("=" * 75)

for i in range(10):
    acc = Account.from_mnemonic(mnemonic, account_path=f"m/44'/60'/0'/0/{i}")
    print(f"Account #{i}: {acc.address}")
    print(f"  Private Key: {acc.key.hex()}\n")
