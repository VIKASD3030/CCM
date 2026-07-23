"""
Migration 003: Move all master/Admin tables from public schema to Master schema.
"""
import sys
sys.path.insert(0, ".")

SCHEMA = "Master"

TABLES_TO_MOVE = [
    "master_records",
    "departments",
    "designations",
    "locations",
    "units",
    "lookups",
    "modules",
    "roles",
    "users",
    "role_permissions",
]


async def run(conn):
    """Execute schema migration."""
    from sqlalchemy import text

    # 1. Create Master schema
    await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
    print(f"  Schema '{SCHEMA}' ready.")

    # 2. Move each table
    for table in TABLES_TO_MOVE:
        result = await conn.execute(
            text(
                "SELECT EXISTS (SELECT FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :t)"
            ),
            {"t": table},
        )
        if not result.scalar():
            print(f"  SKIP {table} (not in public)")
            continue

        await conn.execute(text(f'ALTER TABLE public."{table}" SET SCHEMA "{SCHEMA}"'))
        print(f"  Moved: {table}")

        # Move sequences
        seq_r = await conn.execute(
            text(
                "SELECT sequence_name FROM information_schema.sequences "
                "WHERE sequence_schema = 'public' AND sequence_name LIKE :p"
            ),
            {"p": f"{table}%"},
        )
        for row in seq_r:
            await conn.execute(text(f'ALTER SEQUENCE public."{row[0]}" SET SCHEMA "{SCHEMA}"'))
            print(f"  Moved seq: {row[0]}")

    # 3. Fix FK references
    # Drop old FKs (they moved with the table but may point to wrong schema)
    fk_drops = [
        (f'"{SCHEMA}".users', "users_role_fkey"),
        (f'"{SCHEMA}".role_permissions', "role_permissions_role_name_fkey"),
        (f'"{SCHEMA}".role_permissions', "role_permissions_module_key_fkey"),
    ]
    for tbl, con in fk_drops:
        await conn.execute(text(f'ALTER TABLE {tbl} DROP CONSTRAINT IF EXISTS "{con}"'))

    # Recreate FKs pointing to Master schema
    await conn.execute(text(
        f'ALTER TABLE "{SCHEMA}".users '
        f'ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES "{SCHEMA}".roles(name)'
    ))
    print("  FK: users.role -> Master.roles")

    await conn.execute(text(
        f'ALTER TABLE "{SCHEMA}".role_permissions '
        f'ADD CONSTRAINT role_permissions_role_name_fkey '
        f'FOREIGN KEY (role_name) REFERENCES "{SCHEMA}".roles(name) ON DELETE CASCADE'
    ))
    print("  FK: role_permissions.role_name -> Master.roles")

    await conn.execute(text(
        f'ALTER TABLE "{SCHEMA}".role_permissions '
        f'ADD CONSTRAINT role_permissions_module_key_fkey '
        f'FOREIGN KEY (module_key) REFERENCES "{SCHEMA}".modules(key) ON DELETE CASCADE'
    ))
    print("  FK: role_permissions.module_key -> Master.modules")

    print(f"\n  Done! {len(TABLES_TO_MOVE)} tables moved to '{SCHEMA}'.")
