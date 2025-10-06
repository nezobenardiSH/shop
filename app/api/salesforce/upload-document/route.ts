import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const trainerId = formData.get('trainerId') as string
    const documentType = formData.get('documentType') as string

    if (!file || !trainerId || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Upload to Salesforce Files
    const conn = await getSalesforceConnection()
    
    if (!conn) {
      return NextResponse.json(
        { error: 'Salesforce connection not available' },
        { status: 500 }
      )
    }
    
    // Create a ContentVersion (file upload)
    const contentVersion = await conn.sobject('ContentVersion').create({
      Title: `${documentType.toUpperCase()}_${file.name}`,
      VersionData: buffer.toString('base64'),
      PathOnClient: file.name,
      FirstPublishLocationId: trainerId, // Link to the trainer record
      Origin: 'H' // 'H' for uploaded
    })

    if (!contentVersion.success) {
      console.error('Failed to upload file to Salesforce:', contentVersion)
      return NextResponse.json(
        { error: 'Failed to upload file to Salesforce' },
        { status: 500 }
      )
    }

    // Get the ContentDocument ID for the download link
    const contentVersionRecord = await conn.sobject('ContentVersion').findOne({
      Id: contentVersion.id
    }, ['ContentDocumentId'])

    const downloadUrl = `${conn.instanceUrl}/servlet/servlet.FileDownload?file=${contentVersionRecord.ContentDocumentId}`

    // Update the trainer record with the document link
    const updateField = documentType === 'ssm' ? 'SSM_Document_Link__c' : 'Document_Link__c'
    
    await conn.sobject('Trainer__c').update({
      Id: trainerId,
      [updateField]: downloadUrl
    })

    console.log(`✅ Successfully uploaded ${documentType} document for trainer:`, trainerId)

    return NextResponse.json({
      success: true,
      fileId: contentVersion.id,
      fileUrl: downloadUrl,
      message: `${documentType.toUpperCase()} document uploaded successfully`
    })

  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Document upload endpoint',
    supportedTypes: ['ssm'],
    acceptedFormats: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
  })
}