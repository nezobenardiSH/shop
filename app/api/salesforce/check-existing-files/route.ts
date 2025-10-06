import { NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const trainerId = searchParams.get('trainerId')

    if (!trainerId) {
      return NextResponse.json({ error: 'No trainer ID provided' }, { status: 400 })
    }

    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json({ error: 'Failed to connect to Salesforce' }, { status: 500 })
    }

    // Query existing ContentDocumentLinks for this trainer
    const existingLinks = await conn.query(`
      SELECT Id, ContentDocumentId, ContentDocument.Title, ContentDocument.LatestPublishedVersionId
      FROM ContentDocumentLink
      WHERE LinkedEntityId = '${trainerId}'
      ORDER BY ContentDocument.CreatedDate DESC
    `)

    const files = existingLinks.records.map((link: any) => ({
      id: link.ContentDocumentId,
      title: link.ContentDocument.Title,
      versionId: link.ContentDocument.LatestPublishedVersionId,
      downloadUrl: `${conn.instanceUrl}/sfc/servlet.shepherd/version/download/${link.ContentDocument.LatestPublishedVersionId}`
    }))

    return NextResponse.json({ 
      success: true,
      files: files,
      totalFiles: existingLinks.totalSize
    })

  } catch (error) {
    console.error('Error checking existing files:', error)
    return NextResponse.json({ 
      error: 'Failed to check existing files', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}