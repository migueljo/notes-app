import 'antd/dist/antd.css'

import React from 'react'
import { API } from 'aws-amplify'
import { List, Input, Button } from 'antd'
import { v4 as uuid } from 'uuid'

import { listNotes } from './graphql/queries'
import {
  createNote as CreateNote,
  deleteNote as DeleteNote,
  updateNote as UpdateNote,
} from './graphql/mutations'
import { onCreateNote } from './graphql/subscriptions'

const CLIENT_ID = uuid()

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: { name: '', description: '' }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes, loading: false }
    case 'ERROR':
      return { ...state, loading: false, error: true }
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes]}
    case 'RESET_FORM':
      return { ...state, form: initialState.form }
    case 'SET_INPUT':
      return { ...state, form: { ...state.form, [action.name]: action.value } }
    default:
      return state
  }
}

function App() {
  const [state, dispatch] = React.useReducer(reducer, initialState)

  const fetchNotes = async () => {
    try {
      const notesData = await API.graphql({ query: listNotes })
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items })
    } catch (e) {
      console.error(e)
      dispatch({ type: 'ERROR' })
    }
  }
  const createNote = async () => {
    const {form} = state
    if (!form.name || !form.description) {
      return alert('Please enter a name and description')
    }
    const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() }
    dispatch({ type: 'ADD_NOTE', note })
    dispatch({ type: 'RESET_FORM' })
    console.log({ note })
    try {
      await API.graphql({
        query: CreateNote,
        variables: { input: note }
      })
    } catch (err) {
      console.error(err)
    }
  }
  const deleteNote = async ({ id }) => {
    const notes = state.notes.filter(n => n.id !== id)
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await API.graphql({
        query: DeleteNote,
        variables: { input: { id } }
      })
      console.log("Successfully deleted note!")
    } catch (error) {
      console.error(error)
    }
  }
  const updateNote = async (note) => {
    const index = state.notes.findIndex(n => n.id === note.id)
    const notes = [...state.notes]
    notes[index].completed = !note.completed
    dispatch({ type: 'SET_NOTES', notes})

    try {
      await API.graphql({
        query: UpdateNote,
        variables: { input: { id: note.id, completed: notes[index].completed } }
      })
      console.log('note successfully updated!')
    } catch (err) {
      console.log('error: ', err)
    }
  }
  const onChange = (e) => {
    const { name, value } = e.target
    dispatch({ type: 'SET_INPUT', name, value })
  }

  const renderItem = (item) => {
    return (
      <List.Item
        style={styles.item}
        actions={[
          <p style={styles.p} onClick={() => deleteNote(item)}>Delete</p>,
          <p style={styles.p} onClick={() => updateNote(item)}>
            {item.completed ? 'Completed' : 'Mark completed'}
          </p>
        ]}
      >
        <List.Item.Meta
          title={item.name}
          description={item.description}
        />
      </List.Item>
    )
  }

  React.useEffect(() => {
    fetchNotes()
    const subscription = API.graphql({
      query: onCreateNote
    }).subscribe({
      next: noteData => {
        const note = noteData.value.data.onCreateNote
        if (CLIENT_ID === note.clientId) return
        dispatch({ type: 'ADD_NOTE', note })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div style={styles.container}>
      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder="Note name"
        name="name"
        style={styles.input}
      />
      <Input
        onChange={onChange}
        value={state.form.description}
        placeholder="Note description"
        name="description"
        style={styles.input}
      />
      <Button onClick={createNote} type="primary">Create note</Button>
      <List
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />
    </div>
  )
}

const styles = {
  container: {padding: 20},
  input: {marginBottom: 10},
  item: { textAlign: 'left' },
  p: { color: '#1890ff' }
}

export default App
