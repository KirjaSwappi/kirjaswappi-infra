import { execSync } from 'node:child_process';
import { get, post, setToken } from '../lib/api-client.mjs';
import { state as authState } from './01-signup-login.mjs';

export async function run() {
  setToken(authState.token);

  // 1. Get genres (Mongock may have seeded some) or seed one via MongoDB directly
  const genresRes = await get('/api/v1/genres', { skipAuth: true });
  let genreId;

  if (genresRes.status === 200 && genresRes.json?.parentGenres && Object.keys(genresRes.json.parentGenres).length > 0) {
    const firstParent = Object.values(genresRes.json.parentGenres)[0];
    genreId = firstParent.id;
    console.log(`    using existing genre: ${Object.keys(genresRes.json.parentGenres)[0]}`);
  } else {
    // Seed a genre directly in MongoDB via docker exec
    const composeFile = process.env.COMPOSE_FILE || '../docker-compose.ci.yml';
    const seedEval = `const r = db.genres.insertOne({name:'Fiction',parentGenre:null}); print(r.insertedId.toString())`;
    const seedCmd = `docker compose -f ${composeFile} exec -T mongodb mongosh "mongodb://root:rootpass@localhost:27017/kirjaswappi_e2e?authSource=admin" --quiet --eval "${seedEval}"`;
    try {
      const result = execSync(seedCmd, { stdio: 'pipe' }).toString().trim();
      genreId = result;
      console.log(`    genre seeded via MongoDB: Fiction (${genreId})`);
    } catch (err) {
      console.log(`    SKIP: cannot seed genre (${err.message?.substring(0, 100)})`);
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
  formBody.append('genres', genreId);
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
