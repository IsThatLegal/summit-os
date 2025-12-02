// SiteLink API Client for SummitOS Integration
// Based on SiteLink Web Edition API documentation

export interface SiteLinkConfig {
  apiUrl: string;
  username: string;
  password: string;
  siteId?: string;
  corporateCode?: string;
}

export interface SiteLinkUnit {
  UnitID: string;
  UnitNumber: string;
  Width: number;
  Depth: number;
  Height: number;
  DoorType: 'roll_up' | 'swing';
  Status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  MonthlyPrice: number;
  SquareFeet: number;
  UnitType: string;
  ClimateControlled: boolean;
  Location?: string;
}

export interface SiteLinkTenant {
  TenantID: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  CurrentBalance: number;
  GateCode: string;
  IsLockedOut: boolean;
  UnitID?: string;
  LeaseStartDate?: string;
  LeaseEndDate?: string;
  MonthlyRent: number;
}

export interface SiteLinkTransaction {
  TransactionID: string;
  TenantID: string;
  Amount: number;
  Type: 'payment' | 'charge' | 'fee';
  Description: string;
  Date: string;
  PaymentMethod?: string;
  Status: 'pending' | 'completed' | 'failed';
}

export interface SiteLinkPayment {
  PaymentID: string;
  TenantID: string;
  Amount: number;
  PaymentMethod: 'credit_card' | 'check' | 'money_order' | 'cash' | 'ach';
  Status: 'pending' | 'completed' | 'failed';
  Date: string;
  Description: string;
  CheckNumber?: string;
  MoneyOrderNumber?: string;
  VerificationMethod?: string;
}

export class SiteLinkAPIClient {
  private config: SiteLinkConfig;
  private baseUrl: string;

  constructor(config: SiteLinkConfig) {
    this.config = config;
    this.baseUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');

    const defaultHeaders = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`SiteLink API Error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  // Units API
  async getUnits(siteId?: string): Promise<SiteLinkUnit[]> {
    const endpoint = siteId 
      ? `/api/units?siteId=${siteId}` 
      : '/api/units';
    
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  async getUnit(unitId: string): Promise<SiteLinkUnit> {
    const response = await this.makeRequest(`/api/units/${unitId}`);
    return response.json();
  }

  async updateUnit(unitId: string, unitData: Partial<SiteLinkUnit>): Promise<SiteLinkUnit> {
    const response = await this.makeRequest(`/api/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(unitData),
    });
    return response.json();
  }

  async createUnit(unitData: Omit<SiteLinkUnit, 'UnitID'>): Promise<SiteLinkUnit> {
    const response = await this.makeRequest('/api/units', {
      method: 'POST',
      body: JSON.stringify(unitData),
    });
    return response.json();
  }

  async deleteUnit(unitId: string): Promise<void> {
    await this.makeRequest(`/api/units/${unitId}`, {
      method: 'DELETE',
    });
  }

  // Tenants API
  async getTenants(siteId?: string): Promise<SiteLinkTenant[]> {
    const endpoint = siteId 
      ? `/api/tenants?siteId=${siteId}` 
      : '/api/tenants';
    
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  async getTenant(tenantId: string): Promise<SiteLinkTenant> {
    const response = await this.makeRequest(`/api/tenants/${tenantId}`);
    return response.json();
  }

  async updateTenant(tenantId: string, tenantData: Partial<SiteLinkTenant>): Promise<SiteLinkTenant> {
    const response = await this.makeRequest(`/api/tenants/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(tenantData),
    });
    return response.json();
  }

  async createTenant(tenantData: Omit<SiteLinkTenant, 'TenantID'>): Promise<SiteLinkTenant> {
    const response = await this.makeRequest('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(tenantData),
    });
    return response.json();
  }

  // Transactions API
  async getTransactions(tenantId?: string, siteId?: string): Promise<SiteLinkTransaction[]> {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId);
    if (siteId) params.append('siteId', siteId);
    
    const endpoint = `/api/transactions${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  async createTransaction(transactionData: Omit<SiteLinkTransaction, 'TransactionID'>): Promise<SiteLinkTransaction> {
    const response = await this.makeRequest('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
    return response.json();
  }

  // Payments API
  async getPayments(tenantId?: string, siteId?: string): Promise<SiteLinkPayment[]> {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId);
    if (siteId) params.append('siteId', siteId);
    
    const endpoint = `/api/payments${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  async processPayment(paymentData: Omit<SiteLinkPayment, 'PaymentID'>): Promise<SiteLinkPayment> {
    const response = await this.makeRequest('/api/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    return response.json();
  }

  // Site Information
  async getSiteInfo(siteId?: string): Promise<any> {
    const endpoint = siteId ? `/api/sites/${siteId}` : '/api/sites';
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  // Availability Check
  async checkAvailability(unitId: string, startDate: string, endDate: string): Promise<boolean> {
    const response = await this.makeRequest(
      `/api/units/${unitId}/availability?startDate=${startDate}&endDate=${endDate}`
    );
    const result = await response.json();
    return result.Available;
  }

  // Gate Operations
  async updateGateAccess(tenantId: string, accessCode: string): Promise<void> {
    await this.makeRequest(`/api/tenants/${tenantId}/gate-access`, {
      method: 'PUT',
      body: JSON.stringify({ GateCode: accessCode }),
    });
  }

  async logGateActivity(activity: {
    tenantId: string;
    action: 'entry' | 'exit' | 'denied';
    timestamp: string;
    reason?: string;
  }): Promise<void> {
    await this.makeRequest('/api/gate-logs', {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  }

  // Reports
  async getOccupancyReport(siteId?: string, startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (siteId) params.append('siteId', siteId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const endpoint = `/api/reports/occupancy${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  async getFinancialReport(siteId?: string, startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (siteId) params.append('siteId', siteId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const endpoint = `/api/reports/financial${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    return response.json();
  }
}

// Utility functions for data mapping
export class SiteLinkDataMapper {
  static mapUnitToSummitOS(sitelinkUnit: SiteLinkUnit): Omit<any, 'id'> {
    return {
      unit_number: sitelinkUnit.UnitNumber,
      size: `${sitelinkUnit.Width}x${sitelinkUnit.Depth}`,
      monthly_price: Math.round(sitelinkUnit.MonthlyPrice * 100), // Convert to cents
      status: sitelinkUnit.Status,
      door_type: sitelinkUnit.DoorType === 'roll_up' ? 'roll-up' : 'swing',
      width: sitelinkUnit.Width,
      depth: sitelinkUnit.Depth,
      height: sitelinkUnit.Height,
      unit_type: sitelinkUnit.UnitType,
      x: 0, // Default position for map
      y: 0,
      rotation: 0,
    };
  }

  static mapSummitOSToSiteLink(summitOSUnit: any): Omit<SiteLinkUnit, 'UnitID'> {
    return {
      UnitNumber: summitOSUnit.unit_number,
      Width: summitOSUnit.width,
      Depth: summitOSUnit.depth,
      Height: summitOSUnit.height,
      DoorType: summitOSUnit.door_type === 'roll-up' ? 'roll_up' : 'swing',
      Status: summitOSUnit.status,
      MonthlyPrice: summitOSUnit.monthly_price / 100, // Convert from cents
      SquareFeet: summitOSUnit.width * summitOSUnit.depth,
      UnitType: summitOSUnit.unit_type || 'standard',
      ClimateControlled: summitOSUnit.unit_type === 'climate',
    };
  }

  static mapTenantToSummitOS(sitelinkTenant: SiteLinkTenant): Omit<any, 'id'> {
    return {
      first_name: sitelinkTenant.FirstName,
      last_name: sitelinkTenant.LastName,
      email: sitelinkTenant.Email,
      phone: sitelinkTenant.Phone,
      current_balance: Math.round(sitelinkTenant.CurrentBalance * 100), // Convert to cents
      gate_access_code: sitelinkTenant.GateCode,
      is_locked_out: sitelinkTenant.IsLockedOut,
      unit_id: sitelinkTenant.UnitID,
    };
  }

  static mapSummitOSToSiteLinkTenant(summitOSTenant: any): Omit<SiteLinkTenant, 'TenantID'> {
    return {
      FirstName: summitOSTenant.first_name,
      LastName: summitOSTenant.last_name || '',
      Email: summitOSTenant.email,
      Phone: summitOSTenant.phone,
      CurrentBalance: summitOSTenant.current_balance / 100, // Convert from cents
      GateCode: summitOSTenant.gate_access_code,
      IsLockedOut: summitOSTenant.is_locked_out,
      UnitID: summitOSTenant.unit_id,
      MonthlyRent: summitOSTenant.monthly_rent || 0,
      Address: summitOSTenant.address || '',
      City: summitOSTenant.city || '',
      State: summitOSTenant.state || '',
      Zip: summitOSTenant.zip || '',
    };
  }

  static mapTransactionToSummitOS(sitelinkTransaction: SiteLinkTransaction): Omit<any, 'id'> {
    return {
      tenant_id: sitelinkTransaction.TenantID,
      amount: Math.round(sitelinkTransaction.Amount * 100), // Convert to cents
      type: sitelinkTransaction.Type,
      description: sitelinkTransaction.Description,
      created_at: sitelinkTransaction.Date,
      payment_method: sitelinkTransaction.PaymentMethod,
      status: sitelinkTransaction.Status,
    };
  }

  static mapSummitOSToSiteLinkTransaction(summitOSTransaction: any): Omit<SiteLinkTransaction, 'TransactionID'> {
    return {
      TenantID: summitOSTransaction.tenant_id,
      Amount: summitOSTransaction.amount / 100, // Convert from cents
      Type: summitOSTransaction.type,
      Description: summitOSTransaction.description,
      Date: summitOSTransaction.created_at,
      PaymentMethod: (summitOSTransaction.payment_method as 'credit_card' | 'check' | 'money_order' | 'cash' | 'ach') || 'cash',
      Status: summitOSTransaction.status,
    };
  }
}