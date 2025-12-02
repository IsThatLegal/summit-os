import { NextRequest, NextResponse } from 'next/server';
import { siteLinkIntegration } from '@/lib/sitelink-integration';

export async function GET(request: NextRequest) {
  try {
    const testResult = await siteLinkIntegration.testConnection();
    
    return NextResponse.json({
      success: true,
      message: 'SiteLink integration status retrieved',
      data: {
        configured: siteLinkIntegration.isIntegrationAvailable(),
        connection: testResult,
      }
    });
  } catch (error) {
    console.error('SiteLink status check failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check SiteLink integration status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'sync-units':
        const unitsResult = await siteLinkIntegration.syncUnitsFromSiteLink();
        return NextResponse.json({
          success: true,
          message: 'Units sync completed',
          data: unitsResult
        });

      case 'sync-tenants':
        const tenantsResult = await siteLinkIntegration.syncTenantsFromSiteLink();
        return NextResponse.json({
          success: true,
          message: 'Tenants sync completed',
          data: tenantsResult
        });

      case 'sync-transactions':
        const transactionsResult = await siteLinkIntegration.syncTransactionsFromSiteLink();
        return NextResponse.json({
          success: true,
          message: 'Transactions sync completed',
          data: transactionsResult
        });

      case 'full-sync':
        const fullSyncResult = await siteLinkIntegration.performFullSync();
        return NextResponse.json({
          success: true,
          message: 'Full sync completed',
          data: fullSyncResult
        });

      case 'test-connection':
        const testResult = await siteLinkIntegration.testConnection();
        return NextResponse.json({
          success: testResult.success,
          message: testResult.message,
          data: { siteInfo: testResult.siteInfo }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('SiteLink sync operation failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'SiteLink sync operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}