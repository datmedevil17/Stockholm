import { NextRequest, NextResponse } from 'next/server'

let data = [
  { id: 1, name: 'Item 1', description: 'First item' },
  { id: 2, name: 'Item 2', description: 'Second item' }
]

export async function GET(request: NextRequest) {
  try {
    // Optional: Get query parameters
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (id) {
      const item = data.find(item => item.id === parseInt(id))
      if (!item) {
        return NextResponse.json(
          { error: 'Item not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(item)
    }
    
    // Return all data
    return NextResponse.json({
      success: true,
      data: data,
      count: data.length
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

// POST handler - create new data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      )
    }
    
    // Create new item
    const newItem = {
      id: data.length + 1,
      name: body.name,
      description: body.description,
      createdAt: new Date().toISOString()
    }
    
    data.push(newItem)
    
    return NextResponse.json(
      {
        success: true,
        message: 'Item created successfully',
        data: newItem
      },
      { status: 201 }
    )
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}

// PUT handler - update existing data
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required for update' },
        { status: 400 }
      )
    }
    
    const itemIndex = data.findIndex(item => item.id === parseInt(id))
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }
    
    // Update item
    data[itemIndex] = {
      ...data[itemIndex],
      ...(name && { name }),
      ...(description && { description }),
      updatedAt: new Date().toISOString()
    }
    
    return NextResponse.json({
      success: true,
      message: 'Item updated successfully',
      data: data[itemIndex]
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE handler - remove data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required for deletion' },
        { status: 400 }
      )
    }
    
    const itemIndex = data.findIndex(item => item.id === parseInt(id))
    if (itemIndex === -1) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }
    
    const deletedItem = data.splice(itemIndex, 1)[0]
    
    return NextResponse.json({
      success: true,
      message: 'Item deleted successfully',
      data: deletedItem
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}