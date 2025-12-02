# SiteLink Web Edition Integration for SummitOS

This guide explains how to integrate SummitOS with SiteLink Web Edition for real-time data synchronization.

## Overview

SummitOS now supports full integration with SiteLink Web Edition, allowing you to:
- Sync units, tenants, and transactions between systems
- Process payments through SiteLink's payment gateway
- Maintain real-time availability across both platforms
- Leverage SiteLink's robust management features alongside SummitOS

## Prerequisites

1. **SiteLink Web Edition Account**
   - Must have SiteLink Web Edition with API access
   - Corporate Control Center access required

2. **API User Setup**
   - Create dedicated API user with proper permissions
   - "API All Reports" permission required for full access

## Configuration

### 1. SiteLink API User Setup

Follow these steps in SiteLink Corporate Control Center:

1. **Create Security Policy**
   - Name: "SummitOS Integration"
   - Type: "Site"
   - Description: "API access for SummitOS integration"
   - Select the sites you want to integrate

2. **Create API User**
   - Username: `summitos_api` (or your preferred username)
   - Password: Generate secure password
   - Permitted Rights: **"API All Reports"** (required)
   - Site Access: Select sites from your security policy

### 2. Environment Configuration

Copy `.env.sitelink.example` to `.env.local` and update with your credentials:

```bash
# Required: SiteLink API Credentials
SITELINK_API_URL=https://your-sitelink-server.com/api
SITELINK_USERNAME=summitos_api
SITELINK_PASSWORD=your_secure_password

# Optional: Site and Corporate Configuration
SITELINK_SITE_ID=your_site_id
SITELINK_CORPORATE_CODE=your_corporate_code

# Integration Settings
SITELINK_SYNC_ENABLED=true
SITELINK_AUTO_SYNC_INTERVAL=300000  # 5 minutes in milliseconds
SITELINK_REAL_TIME_SYNC=true
```

## Integration Features

### Data Synchronization

**Two-Way Sync:**
- **SiteLink → SummitOS**: Import units, tenants, transactions
- **SummitOS → SiteLink**: Push updates back to SiteLink
- **Real-time availability**: Check unit availability across systems
- **Conflict resolution**: Handle data discrepancies intelligently

**Supported Data Types:**
- Units (pricing, availability, dimensions, status)
- Tenants (contact info, balances, gate codes)
- Transactions (payments, charges, fees)
- Payments (all payment methods with verification)

### API Endpoints

The integration supports these SiteLink API endpoints:

```
Units:
- GET /api/units - List all units
- GET /api/units/{id} - Get specific unit
- POST /api/units - Create new unit
- PUT /api/units/{id} - Update unit
- DELETE /api/units/{id} - Delete unit

Tenants:
- GET /api/tenants - List all tenants
- GET /api/tenants/{id} - Get specific tenant
- POST /api/tenants - Create new tenant
- PUT /api/tenants/{id} - Update tenant
- DELETE /api/tenants/{id} - Delete tenant

Transactions:
- GET /api/transactions - List transactions
- POST /api/transactions - Create transaction

Payments:
- GET /api/payments - List payments
- POST /api/payments - Process payment

Site Info:
- GET /api/sites - Get site information
- GET /api/sites/{id} - Get specific site
```

## Usage Examples

### Manual Sync

```javascript
// Sync units from SiteLink to SummitOS
const response = await fetch('/api/sitelink/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'sync-units' })
});

const result = await response.json();
console.log(`Synced ${result.data.units.synced} units`);
```

### Real-time Availability

```javascript
// Check unit availability across both systems
const availability = await siteLinkIntegration.checkRealTimeAvailability('unit-123');
if (availability) {
  console.log('Unit is available');
} else {
  console.log('Unit is occupied');
}
```

### Payment Processing

```javascript
// Process payment through SiteLink
const paymentData = {
  tenantId: 'tenant-123',
  amount: 15000, // $150.00 in cents
  paymentMethod: 'credit_card',
  description: 'Monthly rent'
};

const result = await siteLinkIntegration.pushPaymentToSiteLink(paymentData);
if (result.success) {
  console.log('Payment processed successfully');
}
```

## Data Mapping

### Unit Mapping

| SummitOS Field | SiteLink Field | Notes |
|---|---|---|
| unit_number | UnitNumber | Unit identifier |
| width | Width | Width in feet |
| depth | Depth | Depth in feet |
| height | Height | Height in feet |
| monthly_price | MonthlyPrice | Monthly rent price |
| status | Status | available/occupied/maintenance |
| door_type | DoorType | roll_up/swing |
| unit_type | UnitType | Standard/climate/etc |

### Tenant Mapping

| SummitOS Field | SiteLink Field | Notes |
|---|---|---|
| first_name | FirstName | Tenant first name |
| last_name | LastName | Tenant last name |
| email | Email | Email address |
| phone | Phone | Phone number |
| current_balance | CurrentBalance | Account balance |
| gate_access_code | GateCode | Gate access code |
| is_locked_out | IsLockedOut | Lockout status |

### Transaction Mapping

| SummitOS Field | SiteLink Field | Notes |
|---|---|---|
| tenant_id | TenantID | Tenant identifier |
| amount | Amount | Transaction amount |
| type | Type | payment/charge/fee |
| description | Description | Transaction description |
| created_at | Date | Transaction date |

## Security Considerations

1. **API Credentials**
   - Store in environment variables, not code
   - Use HTTPS endpoints only
   - Implement proper access controls

2. **Data Validation**
   - Validate all data before syncing
   - Handle API errors gracefully
   - Log all sync operations

3. **Rate Limiting**
   - Implement exponential backoff for failed requests
   - Cache data appropriately
   - Monitor API usage

## Troubleshooting

### Common Issues

**Connection Failed:**
- Verify API credentials in `.env.local`
- Check SiteLink user permissions
- Ensure API URL is correct
- Verify network connectivity

**Sync Errors:**
- Check data format compatibility
- Validate required fields
- Review SiteLink API documentation
- Check for data conflicts

**Permission Denied:**
- Verify "API All Reports" permission
- Check security policy assignments
- Ensure user is not locked out
- Contact SiteLink support if needed

### Testing Connection

```bash
# Test SiteLink connection
curl -X POST http://localhost:3000/api/sitelink/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "test-connection"}'
```

## Best Practices

1. **Incremental Rollout**
   - Test with single unit/tenant first
   - Monitor sync performance
   - Roll out gradually to all data

2. **Backup Strategy**
   - Backup SummitOS data before initial sync
   - Keep SiteLink data backup
   - Document sync processes

3. **Monitoring**
   - Monitor sync success/failure rates
   - Set up alerts for failures
   - Log all API interactions

4. **Performance**
   - Use batch operations for large datasets
   - Implement caching for frequently accessed data
   - Schedule syncs during off-peak hours

## Support

For SiteLink API support:
- Contact your SiteLink account representative
- Visit SiteLink help documentation
- Review SiteLink Corporate Control Center guides

For SummitOS integration support:
- Check SummitOS logs for sync errors
- Review API response logs
- Monitor database for data integrity

## Next Steps

1. Configure your SiteLink API credentials
2. Set up environment variables
3. Test the connection using the sync API
4. Enable automatic syncing for your facility
5. Monitor and optimize sync performance

This integration provides a robust bridge between SummitOS and SiteLink Web Edition, enabling you to leverage both platforms' strengths while maintaining data consistency and real-time synchronization.