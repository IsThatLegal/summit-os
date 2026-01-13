import { SiteLinkAPIClient, SiteLinkDataMapper } from './sitelink-client';
import { getSupabase } from './supabaseClient';

export class SiteLinkIntegration {
  private sitelinkClient: SiteLinkAPIClient | null;
  private isEnabled: boolean;

  constructor() {
    // Check if SiteLink integration is enabled
    this.isEnabled = !!process.env.SITELINK_API_URL && 
                   !!process.env.SITELINK_USERNAME && 
                   !!process.env.SITELINK_PASSWORD;

    if (this.isEnabled) {
      this.sitelinkClient = new SiteLinkAPIClient({
        apiUrl: process.env.SITELINK_API_URL!,
        username: process.env.SITELINK_USERNAME!,
        password: process.env.SITELINK_PASSWORD!,
        siteId: process.env.SITELINK_SITE_ID,
        corporateCode: process.env.SITELINK_CORPORATE_CODE,
      });
    } else {
      this.sitelinkClient = null;
    }
  }

  // Check if integration is available
  isIntegrationAvailable(): boolean {
    return this.isEnabled;
  }

  // Sync Units from SiteLink to SummitOS
  async syncUnitsFromSiteLink(): Promise<{ synced: number; errors: string[] }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { synced: 0, errors: ['SiteLink integration not configured'] };
    }

    try {
      const supabase = getSupabase();
      const sitelinkUnits = await this.sitelinkClient.getUnits();
      
      let syncedCount = 0;
      const errors: string[] = [];

      for (const sitelinkUnit of sitelinkUnits) {
        try {
          const summitOSUnit = SiteLinkDataMapper.mapUnitToSummitOS(sitelinkUnit);
          
          // Check if unit already exists
          const { data: existingUnit } = await supabase
            .from('units')
            .select('id')
            .eq('unit_number', summitOSUnit.unit_number)
            .single();

          if (existingUnit) {
            // Update existing unit
            const { error } = await supabase
              .from('units')
              .update(summitOSUnit)
              .eq('id', existingUnit.id);
            
            if (error) {
              errors.push(`Failed to update unit ${summitOSUnit.unit_number}: ${error.message}`);
            } else {
              syncedCount++;
            }
          } else {
            // Create new unit
            const { error } = await supabase
              .from('units')
              .insert(summitOSUnit);
            
            if (error) {
              errors.push(`Failed to create unit ${summitOSUnit.unit_number}: ${error.message}`);
            } else {
              syncedCount++;
            }
          }
        } catch (error) {
          errors.push(`Error processing unit ${sitelinkUnit.UnitNumber}: ${error}`);
        }
      }

      return { synced: syncedCount, errors };
    } catch (error) {
      return { synced: 0, errors: [`Failed to sync units: ${error}`] };
    }
  }

  // Sync Tenants from SiteLink to SummitOS
  async syncTenantsFromSiteLink(): Promise<{ synced: number; errors: string[] }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { synced: 0, errors: ['SiteLink integration not configured'] };
    }

    try {
      const supabase = getSupabase();
      const sitelinkTenants = await this.sitelinkClient.getTenants();
      
      let syncedCount = 0;
      const errors: string[] = [];

      for (const sitelinkTenant of sitelinkTenants) {
        try {
          const summitOSTenant = SiteLinkDataMapper.mapTenantToSummitOS(sitelinkTenant);
          
          // Check if tenant already exists
          const { data: existingTenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('email', summitOSTenant.email)
            .single();

          if (existingTenant) {
            // Update existing tenant
            const { error } = await supabase
              .from('tenants')
              .update(summitOSTenant)
              .eq('id', existingTenant.id);
            
            if (error) {
              errors.push(`Failed to update tenant ${summitOSTenant.email}: ${error.message}`);
            } else {
              syncedCount++;
            }
          } else {
            // Create new tenant
            const { error } = await supabase
              .from('tenants')
              .insert(summitOSTenant);
            
            if (error) {
              errors.push(`Failed to create tenant ${summitOSTenant.email}: ${error.message}`);
            } else {
              syncedCount++;
            }
          }
        } catch (error) {
          errors.push(`Error processing tenant ${sitelinkTenant.Email}: ${error}`);
        }
      }

      return { synced: syncedCount, errors };
    } catch (error) {
      return { synced: 0, errors: [`Failed to sync tenants: ${error}`] };
    }
  }

  // Sync Transactions from SiteLink to SummitOS
  async syncTransactionsFromSiteLink(): Promise<{ synced: number; errors: string[] }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { synced: 0, errors: ['SiteLink integration not configured'] };
    }

    try {
      const supabase = getSupabase();
      const sitelinkTransactions = await this.sitelinkClient.getTransactions();
      
      let syncedCount = 0;
      const errors: string[] = [];

      for (const sitelinkTransaction of sitelinkTransactions) {
        try {
          const summitOSTransaction = SiteLinkDataMapper.mapTransactionToSummitOS(sitelinkTransaction);
          
          // Create new transaction
          const { error } = await supabase
            .from('transactions')
            .insert(summitOSTransaction);
          
          if (error) {
            errors.push(`Failed to create transaction ${sitelinkTransaction.TransactionID}: ${error.message}`);
          } else {
            syncedCount++;
          }
        } catch (error) {
          errors.push(`Error processing transaction ${sitelinkTransaction.TransactionID}: ${error}`);
        }
      }

      return { synced: syncedCount, errors };
    } catch (error) {
      return { synced: 0, errors: [`Failed to sync transactions: ${error}`] };
    }
  }

  // Push Unit updates from SummitOS to SiteLink
  async pushUnitToSiteLink(unitId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { success: false, error: 'SiteLink integration not configured' };
    }

    try {
      const supabase = getSupabase();
      
      // Get unit from SummitOS
      const { data: unit, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single();

      if (error || !unit) {
        return { success: false, error: 'Unit not found in SummitOS' };
      }

      // Map to SiteLink format and push
      const sitelinkUnit = SiteLinkDataMapper.mapSummitOSToSiteLink(unit);
      await this.sitelinkClient.updateUnit(unitId, sitelinkUnit);

      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to push unit to SiteLink: ${error}` };
    }
  }

  // Push Tenant updates from SummitOS to SiteLink
  async pushTenantToSiteLink(tenantId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { success: false, error: 'SiteLink integration not configured' };
    }

    try {
      const supabase = getSupabase();
      
      // Get tenant from SummitOS
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (error || !tenant) {
        return { success: false, error: 'Tenant not found in SummitOS' };
      }

      // Map to SiteLink format and push
      const sitelinkTenant = SiteLinkDataMapper.mapSummitOSToSiteLinkTenant(tenant);
      await this.sitelinkClient.updateTenant(tenantId, sitelinkTenant);

      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to push tenant to SiteLink: ${error}` };
    }
  }

  // Push payments from SummitOS to SiteLink
  async pushPaymentToSiteLink(paymentData: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { success: false, error: 'SiteLink integration not configured' };
    }

    try {
      // Map to SiteLink format and process
      const sitelinkPayment = {
        TenantID: paymentData.tenant_id,
        Amount: paymentData.amount / 100, // Convert from cents
        Type: 'Payment',
        Description: paymentData.description,
        Date: new Date().toISOString(),
        PaymentMethod: (paymentData.payment_method as 'credit_card' | 'check' | 'money_order' | 'cash' | 'ach') || 'cash',
        Status: 'completed' as const,
      };
      await this.sitelinkClient!.processPayment(sitelinkPayment);

      return { success: true };
    } catch (error) {
      return { success: false, error: `Failed to push payment to SiteLink: ${error}` };
    }
  }

  // Real-time availability check
  async checkRealTimeAvailability(unitId: string): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      return await this.sitelinkClient!.checkAvailability(unitId, today, tomorrow);
    } catch (error) {
      console.error('Failed to check availability:', error);
      return false;
    }
  }

  // Full sync - all data from SiteLink to SummitOS
  async performFullSync(): Promise<{
    units: { synced: number; errors: string[] };
    tenants: { synced: number; errors: string[] };
    transactions: { synced: number; errors: string[] };
  }> {
    const results = {
      units: { synced: 0, errors: [] as string[] },
      tenants: { synced: 0, errors: [] as string[] },
      transactions: { synced: 0, errors: [] as string[] },
    };

    if (!this.isEnabled) {
      const error = 'SiteLink integration not configured';
      return {
        units: { synced: 0, errors: [error] },
        tenants: { synced: 0, errors: [error] },
        transactions: { synced: 0, errors: [error] },
      };
    }

    try {
      // Run all sync operations in parallel
      const [unitsResult, tenantsResult, transactionsResult] = await Promise.allSettled([
        this.syncUnitsFromSiteLink(),
        this.syncTenantsFromSiteLink(),
        this.syncTransactionsFromSiteLink(),
      ]);

      if (unitsResult.status === 'fulfilled') {
        results.units = unitsResult.value;
      } else {
        results.units.errors.push(`Units sync failed: ${unitsResult.reason}`);
      }

      if (tenantsResult.status === 'fulfilled') {
        results.tenants = tenantsResult.value;
      } else {
        results.tenants.errors.push(`Tenants sync failed: ${tenantsResult.reason}`);
      }

      if (transactionsResult.status === 'fulfilled') {
        results.transactions = transactionsResult.value;
      } else {
        results.transactions.errors.push(`Transactions sync failed: ${transactionsResult.reason}`);
      }

      return results;
    } catch (error) {
      const errorMsg = `Full sync failed: ${error}`;
      return {
        units: { synced: 0, errors: [errorMsg] },
        tenants: { synced: 0, errors: [errorMsg] },
        transactions: { synced: 0, errors: [errorMsg] },
      };
    }
  }

  // Get SiteLink site information
  async getSiteInfo(): Promise<Record<string, unknown>> {
    if (!this.isEnabled || !this.sitelinkClient) {
      throw new Error('SiteLink integration not configured');
    }

    return await this.sitelinkClient.getSiteInfo();
  }

  // Test connection to SiteLink
  async testConnection(): Promise<{ success: boolean; message: string; siteInfo?: Record<string, unknown> }> {
    if (!this.isEnabled || !this.sitelinkClient) {
      return { 
        success: false, 
        message: 'SiteLink integration not configured. Check environment variables.' 
      };
    }

    try {
      const siteInfo = await this.getSiteInfo();
      return { 
        success: true, 
        message: 'Successfully connected to SiteLink API',
        siteInfo 
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to connect to SiteLink: ${error}` 
      };
    }
  }
}

// Singleton instance
export const siteLinkIntegration = new SiteLinkIntegration();