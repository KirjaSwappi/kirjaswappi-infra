import { get, post, setToken } from '../lib/api-client.mjs';
import { state as authState } from './01-signup-login.mjs';

export async function run() {
  setToken(authState.token);

  // 1. Login as super admin to create a genre (books require genre)
  const adminLogin = await post('/api/v1/users/login', {
    email: process.env.ADMIN_EMAIL || 'admin@kirjaswappi.fi',
    password: process.env.ADMIN_PASSWORD || 'AdminPass1!',
  }, { skipAuth: true });

  if (adminLogin.status !== 200) {
    console.log('    SKIP: admin login failed (super admin seed may not have run)');
    console.log(`    Status: ${adminLogin.status} Body: ${adminLogin.text?.substring(0, 200)}`);
    return;
  }

  const adminToken = adminLogin.json.userToken;

  // 2. Get genres (may already be seeded)
  const genresRes = await get('/api/v1/genres', { headers: { Authorization: `Bearer ${adminToken}` } });
  let genreId;

  if (genresRes.status === 200 && genresRes.json?.length > 0) {
    genreId = genresRes.json[0].id;
    console.log(`    using existing genre: ${genresRes.json[0].name}`);
  } else {
    // Try to create a genre
    const createGenre = await post('/api/v1/genres', { name: 'Fiction' }, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (createGenre.status === 201 || createGenre.status === 200) {
      genreId = createGenre.json?.id;
      console.log('    genre created: Fiction');
    } else {
      console.log(`    SKIP book creation: cannot create genre (${createGenre.status})`);
      return;
    }
  }

  // 3. Create a book (multipart form)
  setToken(authState.token);

  const formBody = new FormData();
  formBody.append('title', 'E2E Test Book');
  formBody.append('author', 'Test Author');
  formBody.append('language', 'ENGLISH');
  formBody.append('condition', 'GOOD');
  formBody.append('genreIds', genreId);
  formBody.append('swapCondition', JSON.stringify({ swapType: 'GIVE_AWAY' }));

  const createBook = await post('/api/v1/books', formBody);

  if (createBook.status !== 201 && createBook.status !== 200) {
    throw new Error(`Book creation failed: ${createBook.status} ${createBook.text?.substring(0, 300)}`);
  }

  const bookId = createBook.json?.id;
  console.log(`    book created: ${bookId}`);

  // 4. Get book by ID
  const getBook = await get(`/api/v1/books/${bookId}`, { skipAuth: true });
  if (getBook.status !== 200) {
    throw new Error(`Get book failed: ${getBook.status}`);
  }
  console.log('    get book OK');

  // 5. List books (public)
  const listBooks = await get('/api/v1/books', { skipAuth: true });
  if (listBooks.status !== 200) {
    throw new Error(`List books failed: ${listBooks.status}`);
  }
  console.log(`    list books OK (${listBooks.json?.content?.length || listBooks.json?.length || 0} results)`);
}
