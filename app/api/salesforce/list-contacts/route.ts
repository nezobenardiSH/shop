import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'

export async function GET(request: NextRequest) {
  try {
    const conn = await getSalesforceConnection()

    if (!conn) {
      return NextResponse.json(
        { error: 'No Salesforce connection available' },
        { status: 500 }
      )
    }

    // Query both Users and Contacts
    const userQuery = `
      SELECT Id, Name, Email, Phone, Title, Department, IsActive
      FROM User
      WHERE IsActive = true
      ORDER BY Name
      LIMIT 100
    `

    const contactQuery = `
      SELECT Id, Name, Email, Phone, Title, Department
      FROM Contact
      ORDER BY Name
      LIMIT 100
    `

    console.log('Querying Users:', userQuery)
    const userResult = await conn.query(userQuery)
    console.log(`Found ${userResult.totalSize} active Users`)

    console.log('Querying Contacts:', contactQuery)
    const contactResult = await conn.query(contactQuery)
    console.log(`Found ${contactResult.totalSize} Contacts`)

    return NextResponse.json({
      success: true,
      users: {
        totalCount: userResult.totalSize,
        records: userResult.records.map((user: any) => ({
          id: user.Id,
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          title: user.Title,
          department: user.Department,
          isActive: user.IsActive
        }))
      },
      contacts: {
        totalCount: contactResult.totalSize,
        records: contactResult.records.map((contact: any) => ({
          id: contact.Id,
          name: contact.Name,
          email: contact.Email,
          phone: contact.Phone,
          title: contact.Title,
          department: contact.Department
        }))
      }
    })
  } catch (error: any) {
    console.error('Error listing users/contacts:', error)
    return NextResponse.json(
      { error: 'Failed to list users/contacts', details: error.message },
      { status: 500 }
    )
  }
}

