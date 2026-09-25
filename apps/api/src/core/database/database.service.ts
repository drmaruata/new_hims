import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'DATABASE_URL',
      'postgresql://postgres:postgrespassword@localhost:5432/hims_db'
    );

    this.pool = new Pool({
      connectionString,
      max: this.configService.get<number>('DATABASE_POOL_MAX', 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async onModuleInit() {
    try {
      const client = await this.pool.connect();
      this.logger.log('Connected to PostgreSQL 18 transactional database cluster');
      client.release();
    } catch (err) {
      this.logger.warn(`Initial database connection warning: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Execute a query with tenant isolation context set inside the session
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params: any[] = [],
    tenantId?: string,
    userId?: string
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      if (tenantId) {
        await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
      }
      if (userId) {
        await client.query(`SET LOCAL app.user_id = $1`, [userId]);
      }
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Execute in an atomic transactional boundary with RLS tenant context
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    tenantId?: string,
    userId?: string
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (tenantId) {
        await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
      }
      if (userId) {
        await client.query(`SET LOCAL app.user_id = $1`, [userId]);
      }
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
