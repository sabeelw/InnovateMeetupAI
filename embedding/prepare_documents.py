from firecrawl import Firecrawl
from chonkie import RecursiveChunker

import os
import weaviate
from weaviate.classes.init import Auth

apikey = os.getenv("FIRE_API_KEY")
weaviate_url = os.environ["WEAVIATE_URL"]
weaviate_api_key = os.environ["WEAVIATE_API_KEY"]

firecrawl = Firecrawl(api_key=apikey)

data = firecrawl.scrape(
    'https://harrypotter.fandom.com/wiki/Harry_Potter',  # CHANGE TO YOUR
    formats=['markdown', 'html']
)

#################################################################
# in case of pdf file
# import pymupdf4llm
# md_text = pymupdf4llm.to_markdown("/path/to/your/file.pdf")
#################################################################

#################################################################
# in case of docx file
# from docx2md import do_convert
# md_text = do_convert("/path/to/your/file.docx", "/path/where/to/save/pictures")
#################################################################


web_f = data.markdown

chunker = RecursiveChunker()
web_chunks = chunker(web_f)

# print chunks chunked by chonkie
for ch in web_chunks:
    print("****************************")
    print(ch)
    print("****************************")


formatted_chunks = web_f.split("## ")
# print chunks spitted by paragraphs
for ch in formatted_chunks:
    print("###########################")
    print(ch)
    print("############################")


# Connect to Weaviate Cloud
client = weaviate.connect_to_weaviate_cloud(
    cluster_url=weaviate_url,
    auth_credentials=Auth.api_key(weaviate_api_key),
)

print(client.is_ready())

questions = client.collections.use("MEETUP") # Change to your collection

with questions.batch.fixed_size(batch_size=200) as batch:
    for d in formatted_chunks:
        batch.add_object(
            {
                "text": d,
            }
        )
        if batch.number_errors > 10:
            print("Batch import stopped due to excessive errors.")
            break

failed_objects = questions.batch.failed_objects
if failed_objects:
    print(f"Number of failed imports: {len(failed_objects)}")
    print(f"First failed object: {failed_objects[0]}")

client.close()
