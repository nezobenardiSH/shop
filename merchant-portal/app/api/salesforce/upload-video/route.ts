import { NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const trainerId = formData.get('trainerId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!trainerId) {
      return NextResponse.json({ error: 'No trainer ID provided' }, { status: 400 })
    }

    const conn = await getSalesforceConnection()
    if (!conn) {
      return NextResponse.json({ error: 'Failed to connect to Salesforce' }, { status: 500 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = buffer.toString('base64')

    // Check if there's already a video document linked to this trainer
    let existingDocumentId = null
    try {
      const existingLinks = await conn.query(`
        SELECT ContentDocumentId, ContentDocument.Title
        FROM ContentDocumentLink
        WHERE LinkedEntityId = '${trainerId}'
        AND ContentDocument.Title LIKE '%video%'
        ORDER BY ContentDocument.CreatedDate DESC
        LIMIT 1
      `)
      
      if (existingLinks.records && existingLinks.records.length > 0) {
        existingDocumentId = (existingLinks.records[0] as any).ContentDocumentId
        console.log('Found existing video document:', existingDocumentId)
      }
    } catch (error) {
      console.log('No existing video found or error checking:', error)
    }

    let contentVersion
    
    if (existingDocumentId) {
      // Create a new version of the existing document
      contentVersion = await conn.sobject('ContentVersion').create({
        Title: file.name,
        PathOnClient: file.name,
        VersionData: base64Data,
        ContentDocumentId: existingDocumentId, // Link to existing document
        Origin: 'C',
        ContentLocation: 'S'
      })
    } else {
      // Create a new document
      contentVersion = await conn.sobject('ContentVersion').create({
        Title: file.name,
        PathOnClient: file.name,
        VersionData: base64Data,
        FirstPublishLocationId: trainerId, // This will auto-create the ContentDocumentLink
        Origin: 'C',
        ContentLocation: 'S'
      })
    }

    if (!contentVersion.success) {
      throw new Error('Failed to create ContentVersion')
    }

    // Query the created ContentVersion to get ContentDocumentId
    const createdVersion = await conn.query(
      `SELECT Id, ContentDocumentId, Title FROM ContentVersion WHERE Id = '${contentVersion.id}'`
    )

    if (!createdVersion.records || createdVersion.records.length === 0) {
      throw new Error('Failed to retrieve created ContentVersion')
    }

    const contentDocumentId = (createdVersion.records[0] as any).ContentDocumentId

    // Note: ContentDocumentLink is automatically created by FirstPublishLocationId
    // No need to create it manually

    // Generate the public download URL
    const instanceUrl = conn.instanceUrl
    const downloadUrl = `${instanceUrl}/sfc/servlet.shepherd/version/download/${contentVersion.id}`

    // Update the Onboarding_Trainer__c record with the video URL
    const updateResult = await conn.sobject('Onboarding_Trainer__c').update({
      Id: trainerId,
      Video_Proof_Link__c: downloadUrl
    })

    if (!updateResult.success) {
      console.error('Failed to update Video_Proof_Link__c field')
      return NextResponse.json({ 
        error: 'File uploaded but failed to update Video_Proof_Link__c field',
        fileUrl: downloadUrl 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      fileUrl: downloadUrl,
      contentVersionId: contentVersion.id,
      contentDocumentId: contentDocumentId
    })

  } catch (error) {
    console.error('Error uploading video to Salesforce:', error)
    return NextResponse.json({ 
      error: 'Failed to upload video', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Get existing video URL
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

    // Query the Onboarding_Trainer__c record for existing video URL
    const result = await conn.query(
      `SELECT Id, Video_Proof_Link__c FROM Onboarding_Trainer__c WHERE Id = '${trainerId}'`
    )

    if (!result.records || result.records.length === 0) {
      return NextResponse.json({ error: 'Trainer record not found' }, { status: 404 })
    }

    const trainer = result.records[0] as any
    return NextResponse.json({ 
      videoUrl: trainer.Video_Proof_Link__c || null 
    })

  } catch (error) {
    console.error('Error fetching video URL from Salesforce:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch video URL', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}